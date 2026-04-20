# 🛠️ Extending the Machine: The Developer's Implementation Guide

**Author**: Senior System Architect  
**Focus**: Extensibility and Error Prevention

---

## 🚀 Scenario: Adding a New Notification Event
Let's say you want to add a notification for **"Appointment Booked"**. Here is the exact, fail-safe path for an intern or a senior to follow.

### Step 1: Define the Event Identity (Both Services)
You must define the "Language" the services share.
- **Backend**: Update `src/notifications/notification.events.ts`
- **Microservice**: Ensure the same key is in the relevant Enums (if applicable).
```typescript
export enum NotificationEventType {
  APPOINTMENT_BOOKED = 'APPOINTMENT_BOOKED'
}
```
> [!CAUTION]  
> If you miss this, the Backend will throw a **Compilation Error** before it even starts.

### Step 2: The Monolith Logic (Backend)
Find the place where the appointment is saved and trigger the signal.
```typescript
// AppointmentService
await this.notificationProducer.send({
  type: NotificationEventType.APPOINTMENT_BOOKED,
  channels: ['email', 'socket'],
  payload: { patientName: '...', time: '14:00' }
});
```

### Step 3: Create the Assets (Microservice)
1. **Email Template**: Create `appointment-booked.hbs` in `src/modules/email/templates/`.
2. **Socket Handler**: (Optional) If the frontend needs a specific toast message.

### Step 4: Verification (The "Zero-Failure" Check)
Always check your **RabbitMQ Management Dashboard** (`http://localhost:15672`).
- Are messages moving from the Monolith to the queue?
- Are they stuck in the queue? (This means your Microservice worker isn't running).
- Are they in the DLX (Dead Letter Exchange)? (This means a template is missing or the logic threw an error).

---

## 🛠️ Scenario 2: Adding a COMPLETELY NEW Channel (e.g., SMS)
If you need to add a channel like **SMS (Twilio)**, follow the "Blueprint":
1. **Infrastructure**: Add `notification.sms` to your [RabbitMQ Exchange](file:///d:/my_projects/HCMS/notification_service/src/modules/notification/notification.service.ts).
2. **Provider**: Create `SmsModule`, `SmsService`, and `SmsProcessor` in the microservice.
3. **Registration**: 
    - Add `sms` to the `NotificationChannel` type in BOTH services.
    - Add the new worker to the `AppModule` of the microservice.

---

## ⚠️ "The Chain is Broken": What Happens if You Miss a Step?
- **Missed Enum Value**: Compilation error (Best case).
- **Wrong Routing Key**: The backend sends the message to the exchange, but it drops into the void. **The backend thinks it was sent, but the microservice never sees it.**
- **Missing Template**: The `EmailProcessor` will crash and push the message to the **Dead Letter Exchange (DLX)**. You must monitor your DLX logs to catch this.
- **Forgotten RabbitMQ Binding**: The message stays in the Exchange and never reaches a Queue.

---

## 💡 The Senior's Wisdom
**Idempotency is your best friend.** Always design your notifications assuming the same event might be triggered twice. If a user gets two "Welcome" emails, it's a minor annoyance. If a user gets two "Charged $500" notifications, it's a disaster.

*Always code for the failure, not just the success.*
