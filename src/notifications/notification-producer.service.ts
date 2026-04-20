import { Injectable, Logger } from '@nestjs/common';
import { RabbitMQService } from '../brokers/rabbitmq/rabbitmq.service';
import { SendNotificationDto } from './dto/send-notification.dto';
import { NotificationChannel } from './notification.events';

@Injectable()
export class NotificationProducerService {
  private readonly logger = new Logger(NotificationProducerService.name);

  constructor(private readonly rabbitMQService: RabbitMQService) {}

  /**
   * Dispatches a notification event to the appropriate RabbitMQ routing key based on the channel.
   */
  async send(dto: SendNotificationDto) {
    this.logger.log(`Dispatching notification event: ${dto.type} to channels: ${dto.channels.join(', ')}`);

    const channelMap: Record<NotificationChannel, string> = {
      email: 'notification.email',
      whatsapp: 'notification.whatsapp',
      telegram: 'notification.telegram',
      inapp: 'notification.inapp',
      socket: 'notification.socket',
    };

    // Publish to each requested channel
    for (const channel of dto.channels) {
      const routingKey = channelMap[channel];
      if (routingKey) {
        await this.rabbitMQService.publish(
          'notifications.exchange',
          routingKey,
          {
            type: dto.type,
            payload: dto.payload,
            timestamp: new Date().toISOString(),
          }
        );
      }
    }
  }
}
