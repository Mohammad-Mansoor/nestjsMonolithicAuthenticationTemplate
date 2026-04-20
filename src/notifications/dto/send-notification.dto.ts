import { NotificationEventType, NotificationChannel } from '../notification.events';

export class SendNotificationDto {
  type: NotificationEventType;
  channels: NotificationChannel[];
  payload: any;
}
