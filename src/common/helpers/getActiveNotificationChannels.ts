import { NotificationChannel } from "src/notifications/notification.events";

export const getActiveNotificationChannels = (notificationOptions: any)=>{
    const channels: NotificationChannel[] = []
if(notificationOptions.email){
  channels.push('email')
}
if(notificationOptions.whatsapp){
  channels.push('whatsapp')
}
if(notificationOptions.telegram){
  channels.push('telegram')
}
if(notificationOptions.inapp){
  channels.push('inapp')
}
if(notificationOptions.socket){
  channels.push('socket')
}
return channels
}