import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RabbitMQModule } from '../brokers/rabbitmq/rabbitmq.module';
import { NotificationProducerService } from './notification-producer.service';

@Global()
@Module({
  imports: [
    RabbitMQModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        urls: [configService.get<string>('RABBITMQ_URL', 'amqp://localhost:5672')],
        exchanges: [
          {
            name: 'notifications.exchange',
            type: 'topic',
          },
          {
            name: 'app.events',
            type: 'topic',
          },
        ],
      }),
    }),
  ],
  providers: [NotificationProducerService],
  exports: [NotificationProducerService, RabbitMQModule],
})
export class NotificationsModule {}
