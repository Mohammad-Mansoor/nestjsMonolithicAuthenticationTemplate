import { Injectable, Inject, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as amqp from 'amqp-connection-manager';
import { ConfirmChannel, Options } from 'amqplib';
import { RABBITMQ_OPTIONS } from './rabbitmq.constants';
import type { RabbitMQModuleOptions } from './rabbitmq.interfaces';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private connection: amqp.AmqpConnectionManager;
  private channelWrapper: amqp.ChannelWrapper;

  constructor(
    @Inject(RABBITMQ_OPTIONS)
    private readonly options: RabbitMQModuleOptions,
  ) {
    this.connection = amqp.connect(this.options.urls);
    this.channelWrapper = this.connection.createChannel({
      json: true,
      setup: (channel: ConfirmChannel) => this.baseSetup(channel),
    });
  }

  async onModuleInit() {
    this.connection.on('connect', () => {
      this.logger.log('Successfully connected to RabbitMQ broker');
    });

    this.connection.on('disconnect', (err) => {
      this.logger.error('Disconnected from RabbitMQ broker', err.err);
    });
  }

  /**
   * Internal setup for common exchanges.
   */
  private async baseSetup(channel: ConfirmChannel) {
    if (this.options.exchanges && this.options.exchanges.length > 0) {
      await Promise.all(
        this.options.exchanges.map((exchange) =>
          channel.assertExchange(exchange.name, exchange.type, exchange.options || { durable: true }),
        ),
      );
    }
  }

  /**
   * Allows external services to add their own queue/binding setups.
   */
  public async addSetup(setupFn: (channel: ConfirmChannel) => Promise<any>) {
    return this.channelWrapper.addSetup(setupFn);
  }

  async onModuleDestroy() {
    if (this.channelWrapper) {
      await this.channelWrapper.close();
    }
    if (this.connection) {
      await this.connection.close();
    }
  }

  /**
   * Publishes a message to a specific exchange with a routing key
   * 
   * @param exchange The name of the exchange (e.g. notifications.exchange)
   * @param routingKey The routing key to use (e.g. notification.email)
   * @param content The message content/payload
   * @param options Additional publish options (e.g. correlationId, messageId)
   */
  async publish(
    exchange: string,
    routingKey: string,
    content: any,
    options?: Options.Publish,
  ): Promise<boolean> {
    try {
      await this.channelWrapper.publish(exchange, routingKey, content, options);
      this.logger.debug(`Published message to [${exchange}] config using routing key [${routingKey}]`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to publish message: [${exchange}] routing key [${routingKey}]`,
        error instanceof Error ? error.stack : 'Unknown error',
      );
      throw error;
    }
  }
}
