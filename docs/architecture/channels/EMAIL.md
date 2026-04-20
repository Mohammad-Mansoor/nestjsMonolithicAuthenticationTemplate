# 📧 Architectural Deep Dive: The Email Channel

**Author**: Senior System Architect  
**Focus**: Reliability and Temporal Accuracy

---

## 1. Implementation Philosophy
Email is often considered "slow" but mission-critical. In HCMS, we prioritized **Temporal Accuracy**.

### The "Zero-Cache" Policy
We explicitly disabled all template caching. 
- **Reason**: Healthcare data (Doctor names, appointment times) changes frequently. Utilizing a cache could lead to a user receiving a "Session Terminated" or "New Device" email with stale information.
- **Trade-off**: Slightly higher CPU usage during the "Compile" phase of Handlebars, but 100% data integrity.

---

## 2. The Lifecycle of an Email

### Step 1: The Request (Backend)
The Monolith identifies a trigger (e.g., `USER_REGISTERED`).
```typescript
// AuthService
this.notificationProducer.send({
  type: NotificationEventType.USER_REGISTERED,
  channels: ['email'],
  payload: { email: 'user@example.com', tempToken: '...' }
});
```

### Step 2: The Worker Pickup (Microservice)
The [EmailProcessor](file:///d:/my_projects/HCMS/notification_service/src/modules/email/email.processor.ts) pulls from the `notification.email.queue`.
- **Resilience**: We use a **Dead Letter Exchange (DLX)**. If the SMTP server is down, the email isn't lost; it's moved to a `failed` queue for manual inspection or automated retry.

### Step 3: Rendering & Dispatch
The [EmailService](file:///d:/my_projects/HCMS/notification_service/src/modules/email/email.service.ts) performs three tasks:
1. **Template Discovery**: Finds the `.hbs` file on disk based on the event type (`USER_REGISTERED`).
2. **Handlebars Compilation**: Injects the `payload` into the HTML layout.
3. **Nodemailer/SMTP Dispatch**: Sends the final payload to the internet.

---

## 3. Scale and Performance
- **Parallelism**: Since emails are processed in a dedicated RabbitMQ queue, you can run 5 instances of the `notification_service`. They will each pull emails from the queue, allowing you to send thousands of emails per minute without blocking the UI.
- **Worker Isolation**: If the WhatsApp API goes down, the Email queue is **completely unaffected**. This is the beauty of microservices.

---

## 🛠️ Developer Checklist: Adding a New Email
1. **Define the Event**: Add a new key to `NotificationEventType` in both services.
2. **Create the Template**: Add `new-event.hbs` in the microservice's template folder.
3. **Trigger**: Call the `send()` method in the backend.

**The Architect's Tip**: Always test your `.hbs` files with large text blocks. Emails break in the most unexpected ways on mobile devices.
