import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { RabbitMQService } from 'src/brokers/rabbitmq/rabbitmq.service';
import { ConfirmChannel, ConsumeMessage } from 'amqplib';

@Injectable()
export class AuditConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuditConsumer.name);
  private readonly BUFFER_SIZE = 50;
  private readonly FLUSH_INTERVAL = 2000; // 2 seconds

  private buffer: any[] = [];
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    private readonly rabbitMQService: RabbitMQService,
  ) {}

  async onModuleInit() {
    // Register the consumer setup with RabbitMQService
    await this.rabbitMQService.addSetup(async (channel: ConfirmChannel) => {
      // 1. Assert Dead Letter Exchange and Queue for retries
      const dlx = 'audit.dlx';
      const dlq = 'audit.dlq';
      await channel.assertExchange(dlx, 'direct', { durable: true });
      await channel.assertQueue(dlq, { durable: true });
      await channel.bindQueue(dlq, dlx, 'audit.fail');

      // 2. Assert Main Audit Queue with DLQ configuration
      const queue = 'audit.queue';
      await channel.assertQueue(queue, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': dlx,
          'x-dead-letter-routing-key': 'audit.fail',
        },
      });

      // 3. Bind to the central app events exchange
      await channel.bindQueue(queue, 'app.events', 'audit.log');

      // 4. Start Consumption
      await channel.consume(queue, (msg) => this.handleMessage(msg, channel), {
        noAck: false, // Explicit acknowledgement required
      });

      this.logger.log('Audit Consumer started and listening to audit.queue');
    });

    // Start the periodic flush timer
    this.startFlushTimer();
  }

  /**
   * Processes incoming audit messages from RabbitMQ.
   */
  private async handleMessage(msg: ConsumeMessage | null, channel: ConfirmChannel) {
    if (!msg) return;

    try {
      const content = JSON.parse(msg.content.toString());
      this.buffer.push(content);

      // Instant flush if buffer is full
      if (this.buffer.length >= this.BUFFER_SIZE) {
        await this.flushBuffer();
      }

      channel.ack(msg);
    } catch (error) {
      this.logger.error('Failed to process audit message', error);
      // Nack with requeue false will send it to the DLQ based on queue arguments
      channel.nack(msg, false, false);
    }
  }

  /**
   * Batch inserts buffered logs into PostgreSQL and clears the buffer.
   */
  private async flushBuffer() {
    if (this.buffer.length === 0) return;

    const dataToInsert = [...this.buffer];
    this.buffer = []; // Clear immediately to prevent duplicates if insert is slow

    try {
      await this.auditRepo.insert(dataToInsert);
      this.logger.debug(`Successfully batch-inserted ${dataToInsert.length} audit logs.`);
    } catch (error) {
      this.logger.error('Failed to batch insert audit logs', error);
      // Fallback: Restore buffer if possible or log to emergency error file
      this.buffer = [...dataToInsert, ...this.buffer];
    }
  }

  private startFlushTimer() {
    this.flushTimer = setInterval(() => {
      this.flushBuffer().catch(err => this.logger.error('Periodic flush failed', err));
    }, this.FLUSH_INTERVAL);
  }

  async onModuleDestroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    // Final flush before shutdown
    await this.flushBuffer();
  }
}
