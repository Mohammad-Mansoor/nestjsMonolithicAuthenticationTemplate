export enum NotificationEventType {
  SESSION_REVOKED = 'SESSION_REVOKED',
  NEW_DEVICE_LOGIN = 'NEW_DEVICE_LOGIN',
  USER_REGISTERED = 'USER_REGISTERED',
}

export type NotificationChannel = 'email' | 'whatsapp' | 'telegram' | 'inapp' | 'socket';
