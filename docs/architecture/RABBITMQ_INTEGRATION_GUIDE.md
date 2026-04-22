# RabbitMQ Integration Guide: Backend & Notification Microservice

This guide documents the complete event-driven architecture between the **Main Backend** (Producer) and the **Notification Microservice** (Consumer) using RabbitMQ.

---

## 🏗️ Part 1: Usage in Main Backend

The publisher module has been added to `src/brokers/rabbitmq` and `src/notifications`. To use it in your existing services (like Auth or User), you simply need to inject the `NotificationProducerService`.

### 1. Ensure `NotificationsModule` is Imported
In `AppModule` or `AuthModule`, import:
```typescript
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    // Ensure configuration and modules are set up
    NotificationsModule
  ],
  // ...
})
export class AuthModule {}
```

### 2. Publish Events (Auth / User Service)

**Example: `auth.service.ts` (Login / OTP)**
```typescript
import { Injectable } from '@nestjs/common';
import { NotificationProducerService } from '../notifications/notification-producer.service';
import { NotificationEventType } from '../notifications/notification.events';

@Injectable()
export class AuthService {
  constructor(private readonly notificationProducer: NotificationProducerService) {}

  async handleNewDeviceLogin(userId: string, deviceName: string, location: string) {
    // ... authentication logic ...

    // Fire & Forget: Publish Notification Event
    await this.notificationProducer.send({
      type: NotificationEventType.NEW_DEVICE_LOGIN,
      channels: ['email', 'telegram'],
      payload: {
        userId,
        deviceName,
        location,
        time: new Date().toISOString()
      }
    });

    return { status: 'success' };
  }
}
```

---

## 🏗️ Part 2: Notification Service (Consumer Side)

On the **Notification Microservice** end, RabbitMQ acts as the message broker forwarding events to specific channel queues.

### 1. Exchange Binding Strategy
Your microservice must listen to the exact same exchange used by the backend.
- **Exchange Name:** `notifications.exchange`
- **Exchange Type:** `topic`
- **Routing Keys Used:** `notification.email`, `notification.telegram`, `notification.whatsapp`, `notification.inapp`

### 2. Queue Creation & Binding Explained
In a topic exchange, queues are bound using a pattern (`routing_key`).
1. **Declare the Exchange:** Ensures `notifications.exchange` exists.
2. **Declare the Queue:** e.g., `queue: 'notification.email.queue'`.
3. **Bind Queue to Exchange:** Bind `notification.email.queue` to `notifications.exchange` using the routing key `notification.email`.

If a message is published with exactly `notification.email`, RabbitMQ automatically routes it exclusively to the Email queue.

### 3. Consumer Example (Enterprise Grade)
Here is an example setup using `@golevelup/nestjs-rabbitmq` or native `@nestjs/microservices` pattern configured with robustness patterns:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { RabbitSubscribe, Nack } from '@golevelup/nestjs-rabbitmq';
import { IdempotencyService } from '../common/idempotency.service';
import { EmailProvider } from '../providers/email.provider';

@Injectable()
export class EmailConsumerService {
  private readonly logger = new Logger(EmailConsumerService.name);

  constructor(
    private readonly idempotency: IdempotencyService,
    private readonly emailProvider: EmailProvider,
  ) {}

  @RabbitSubscribe({
    exchange: 'notifications.exchange',
    routingKey: 'notification.email',
    queue: 'notification.email.queue',
    queueOptions: {
      durable: true,
      deadLetterExchange: 'notifications.dlx',
      deadLetterRoutingKey: 'notification.email.dlq',
    },
  })
  async handleEmailNotification(event: NotificationEventDto) {
    this.logger.log(`Received Email Event [${event.type}] - Correlation: ${event.correlationId}`);

    // 1. Idempotency Check (Redis)
    const isProcessed = await this.idempotency.isProcessed(event.eventId);
    if (isProcessed) {
      this.logger.warn(`Event ${event.eventId} already processed. Skipping.`);
      return; 
    }

    try {
      // 2. Business Logic / Provider Call (Circuit breaker handled inside provider)
      await this.emailProvider.sendTemplate(event.payload.email, event.type, event.payload);
      
      // 3. Mark processed
      await this.idempotency.markProcessed(event.eventId);
      
    } catch (error) {
      this.logger.error(`Failed to process event ${event.eventId}`, error.stack);
      
      // 4. Retry Logic: Requeue message for retry or Nack to send to DLQ
      // A Nack without requeueing pushes it to the Dead Letter Queue
      return new Nack(false); 
    }
  }
}
```

### 4. Channel Router Flow Explanation
```mermaid
graph TD
    A[Main Backend] -->|Publish (routingKey: notification.sms)| B((notifications.exchange))
    B -->|Route Match: notification.sms| C[notification.sms.queue]
    B -->|Route Match: notification.email| D[notification.email.queue]
    C --> E[SMS Consumer Worker]
    E -->|Check Idempotency| F[(Redis)]
    E -->|Execute| G[Twilio/SNS Provider via Circuit Breaker]
```
1. **Backend** constructs a generic DTO and publishes it to the Exchange.
2. **Exchange** looks at the `routingKey`.
3. It drops the message synchronously into the matching **Channel Queue** (Router).
4. The **Consumer Worker** picks it up, ensures it wasn't processed before, and executes the **Provider**.

---

## ⚙️ Part 3: How to Add a New Channel (e.g. SMS)

Adding a new channel is highly isolated and zero-downtime. 

**Step 1: Add Routing Key (Main Backend)**
Update `NotificationChannel` type in `notification.events.ts` to include `'sms'`.
```typescript
export type NotificationChannel = 'email' | 'sms' | 'telegram' | 'whatsapp' | 'inapp';
```

**Step 2: Create Queue & Binding (Notification Microservice)**
Inside your Notification Microservice, create a new consumer method. The library will auto-create the queue and bind it on startup.
```typescript
@RabbitSubscribe({
  exchange: 'notifications.exchange',
  routingKey: 'notification.sms',
  queue: 'notification.sms.queue',
})
```

**Step 3: Create SMS Consumer**
Write `SmsConsumerService` mirroring the `EmailConsumerService`, taking the event and mapping the payload to phone numbers.

**Step 4: Create Provider Implementation**
Write the actual integration (`TwilioProvider`) implementing your internal notification provider interface. Include circuit breaker annotations (e.g. `opossum` or Resilience4j equivalent).

---

## ▶️ Part 4: How to Run & Monitor the System

### 1. RabbitMQ 
Ensure RabbitMQ is running (e.g., via Docker):
```bash
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
```
- **Management UI:** `http://localhost:15672` (guest/guest)
- **Verify:** Go to the "Exchanges" tab and verify `notifications.exchange` exists. Check the "Queues" tab to ensure channel-specific queues represent bindings.

### 2. Main Backend
- **Environment:** Add `RABBITMQ_URL=amqp://localhost:5672` to your `.env`.
- **Start:** `npm run start:dev`
- **Publish Events:** Trigger the endpoints (e.g., `/auth/login`). The server logs should print: `Successfully published event [NEW_DEVICE_LOGIN] ...`

### 3. Notification Service
- **Start Consumers:** Run the microservice via `npm run start:dev`. The NestJS application context will connect to RabbitMQ and start consuming messages immediately.
- **Scale Workers:** To scale computationally heavy channels (like Email parsing), you can spin up multiple instances of the Notification Microservice (e.g., via Kubernetes Replicas). RabbitMQ automatically load-balances the messages across all listening worker instances connected to the same queue in a Round-Robin pattern.
