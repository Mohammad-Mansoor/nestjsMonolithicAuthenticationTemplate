# 📱 Architectural Deep Dive: Messaging (WhatsApp & Telegram)

**Author**: Senior System Architect  
**Focus**: External Integration and Gateway Patterns

---

## 1. The Strategy: The "Blind worker" Pattern
In system design, your microservice should be "blind" to the source of the event. It doesn't care *why* a user is getting a WhatsApp message; it only knows *how* to talk to the Meta/Telegram API.

### Why Separate Messaging from Email?
1. **Rate Limiting**: WhatsApp and Telegram have strict rate limits. If you send too many too fast, your account gets banned.
2. **Payload Differences**: Messaging channels often require specific phone number formats or Chat IDs that are different from Email addresses.

---

## 2. Integration Workflow

### Step 1: The Routing logic
When the `NotificationProcessor` sees the channel `whatsapp`, it pushes to `notification.whatsapp.queue`.
- **Isolation**: If Meta's API is slow, it won't block your Telegram messages. This is the **Bulkhead Pattern** in system design.

### Step 2: The Provider Interface
Inside [WhatsappService](file:///d:/my_projects/HCMS/notification_service/src/modules/whatsapp/whatsapp.service.ts) and [TelegramService](file:///d:/my_projects/HCMS/notification_service/src/modules/telegram/telegram.service.ts), we use the **Adapter Pattern**.
1. **Mock Mode**: For development, we log to the console.
2. **Production Mode**: We use an HTTP client to POST to `https://api.whatsapp.com` or the Telegram Bot API.

---

## 3. Real-World Handling

### Telegram Bot Flow
Telegram is unique because it requires a `chatId`. 
- **The Step You Can't Miss**: The user must first "Start" your bot. You must store their `chatId` in the Backend DB during that "linking" phase.
- **Payload**: The backend sends the `chatId` in the message payload. The microservice simply delivers it.

### WhatsApp API Flow
- **Templates**: WhatsApp requires pre-approved templates for "business-initiated" messages.
- **Workflow**: The Monolith sends the template name and parameters (`{{1}}`, `{{2}}`), and the microservice maps these to the Meta API call.

---

## 🛠️ Security and Compliance
- **PII (Personally Identifiable Information)**: Messaging channels are often less secure than internal systems. 
- **The Architect's Tip**: **Never** send sensitive health data (e.g., "Your blood test results show X") via WhatsApp. Instead, send a notification: "You have a new secure message in the HCMS portal. [Link]".

---

## ⚠️ The Senior's Warning: Token Expiry
Most messaging APIs use "Access Tokens" that expire every 60 days. If your `notification_service` starts failing all WhatsApp messages, 90% of the time, it's because someone forgot to rotate the API token in the `.env` file.
