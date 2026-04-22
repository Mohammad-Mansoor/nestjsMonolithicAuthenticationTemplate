# Google-Style New Device Notification Plan

To implement a robust, Google-like security system, we need to separate **Sessions** (temporary access) from **Device Identity** (permanent recognition).

## 1. Data Structure Changes
Create a `UserDevice` entity to remember where the user has been.

| Field | Purpose |
| :--- | :--- |
| `deviceId` | Peristent UUID stored in a 1-year cookie. |
| `userId` | Relation to User. |
| `fingerprint` | Hash of Browser + OS + Hardware specs. |
| `isTrusted` | Boolean (user marked this device as safe). |
| `lastLogin` | Timestamp. |

## 2. Detection Flow
1. **Extraction**: During login, extract IP, User-Agent, and `device_id` from cookies.
2. **Identification**:
   - `Known`: `deviceId` exists in DB for this user.
   - `New`: `deviceId` is missing or belongs to a different user.
3. **Geo-Location**: Use a library like `geoip-lite` to turn the IP address into a human-readable location (e.g., "Paris, France").

## 3. The Notification Event
Use `@nestjs/event-emitter` to handle this out-of-band so it doesn't slow down the login response.

```typescript
@OnEvent('auth.new-device')
handleNewDeviceLogin(payload: NewDevicePayload) {
  this.mailService.send({
    template: 'new-device-alert',
    context: {
      device: payload.deviceName,
      location: payload.location,
      time: payload.timestamp,
      revokeUrl: `https://api.health.com/auth/revoke/${payload.sessionId}`
    }
  });
}
```

## 4. User Control
The email must provide an "actionable" link.
- **Button**: "This wasn't me" -> Immediately revokes the session and forces a password reset.
- **Button**: "Trust this device" -> Updates `UserDevice.isTrusted = true`.

## 5. Implementation Steps
1. Create `UserDevice` Entity.
2. Update `AuthService.login` to check the registry.
3. Integrate a Geo-IP provider.
4. Build the Email Template.
