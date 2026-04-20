# ⚡ Architectural Deep Dive: Stateful Sockets

**Author**: Senior System Architect  
**Focus**: Identity, Presence, and Global Kill-Switches

---

## 1. The Challenge of "State"
In a typical REST API, the server forgets the user as soon as the request ends. In WebSockets, the server must **"remember"** the user for the entire duration of their visit. This is called **State**.

### Why We Moved Sockets to a Microservice
1. **Connection Bloat**: Managing 10,000 open connections consumes persistent memory. We shouldn't burden the business logic (Monolith) with this overhead.
2. **Identity Sync**: We need a way to say "Log User 123 out" and have it happen immediately, regardless of which instance they are connected to.

---

## 2. The Identity Handshake
We use an **Identity-First** handshake. 
1. **The Guard**: The [SocketGateway](file:///d:/my_projects/HCMS/notification_service/src/modules/socket/socket.gateway.ts) requires a JWT in the `auth.token` field during connection.
2. **Verification**: The microservice uses the `JWT_SECRET` (shared with the backend) to extract the `userId` and `sessionId`.
3. **The Bind**: If valid, we allow the connection. If invalid, the socket is rejected immediately.

---

## 3. Redis Presence Registry
How do we know who is connected? We use **Redis Hashes**.
- **Key**: `presence:user:{userId}`
- **Field**: `{sessionId}`
- **Value**: `{socketId}`

**Benefit**: This allows a single user to have multiple sessions (Laptop, Phone, Tablet) while giving us the precision to kill only one session or "Logout All" sessions at once.

---

## 4. Scaling: The Redis Adapter
When you have multiple instances of this service, a message received by Instance A might need to disconnect a socket owned by Instance B.
- **The Solution**: We implemented the **Redis IoAdapter**.
- **The Flow**: When `server.in(socketId).disconnectSockets()` is called, Instance A tells Redis, "Hey, anyone hosting Socket ID #123, kill it." Instance B hears this and kills the connection.
- **Result**: Zero-latency global synchronization.

---

## 5. The "Kill Switch" Flow (Real World Example)
1. **Backend**: Dispatches `SESSION_REVOKED` via RabbitMQ.
2. **SocketConsumer**: Receives the message.
3. **Logic**:
    - If `target: ALL`: Get all socket IDs from the Redis Hash for that user.
    - Loop and Emit: `SESSION_TERMINATED`.
    - Enforce: Call `disconnect()`.
4. **Frontend**: Receives the event, clears cache, and redirects.

**Architect's Advice**: Never trust the client to disconnect themselves. Always emit the "Goodbye" event and then **force** the disconnect from the server side.
