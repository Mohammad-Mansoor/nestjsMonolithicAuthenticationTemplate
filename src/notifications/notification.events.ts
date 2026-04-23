export enum NotificationEventType {
  SESSION_REVOKED = 'SESSION_REVOKED',
  NEW_DEVICE_LOGIN = 'NEW_DEVICE_LOGIN',
  USER_REGISTERED = 'USER_REGISTERED',
  PASSWORD_RESET = 'PASSWORD_RESET',
  FORGOT_PASSWORD = 'FORGOT_PASSWORD',
}

export type NotificationChannel = 'email' | 'whatsapp' | 'telegram' | 'inapp' | 'socket';
