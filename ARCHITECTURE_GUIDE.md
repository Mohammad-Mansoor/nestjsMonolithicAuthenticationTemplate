# Health Care System - Architecture Guide

This document explains the core architecture and logic of the system we've built, focusing on File Management, Security, and Database Relationships.

---

## 1. The Generic File Upload System
We use a **Polymorphic-lite** architecture for files. This means a single `File` entity can belong to anything.

### How it works:
- **`referenceId`**: Stores the ID of the related object (e.g., an Ambulance ID).
- **`referenceType`**: An Enum describing the object type (`USER_PROFILE`, `AMBULANCE_DOC`, etc.).
- **`uploadedBy`**: Every file tracks the User who uploaded it for audit logs.

### Why we use this:
Instead of adding a `profileImg` column to every table, we keep all files in one place. You can add new features (like "Doctor Degrees" or "Patient Scans") without changing the database schema.

---

## 2. Upload & Deletion Flow

### The Upload Flow
1. **Controller**: Uses `FileInterceptor` (with `multerConfig`) to stream the file straight to the `./uploads` folder.
2. **Validation**: The `FileValidationPipe` checks the size and mimetype before the file is even processed by the service.
3. **Storage Logic**: The `StorageService` (via `LocalStorageService`) captures the physical path and filename.
4. **Database Logic**: The `FileService` creates a row in the `Files` table, linking the physical path to the `referenceId`, `referenceType`, and the `User` who uploaded it.

### The Deletion Flow (Self-Cleaning)
The system is designed to prevent "disk bloat."
1. **`FileService.remove(id)`**: This is the atomic deletion unit. It deletes the record from the DB **and** the actual file from the disk.
2. **On Update**: Always check if an entity already has a file before uploading a new one. Call `fileService.remove()` on the old ID to keep the server clean.
3. **On Delete**: When deleting a parent entity (like a User or Ambulance), always call `fileService.removeByReference()` to wipe all associated documents.

---

## 3. Developer Guide: How to Use File Services

### 📤 When to use `upload` vs `uploadMany`
- **Use `upload`**: For single, specific images like a Profile Photo or a primary ID scan.
- **Use `uploadMany`**: For collections like "Medical Reports," "Gallery," or "Supporting Documents." It uses `Promise.all` to perform multiple uploads in parallel for maximum speed.

### 🔍 How to retrieve files
Since we use a polymorphic-lite approach (no hard database FKs in the parent table), you should fetch files in your target service like this:
```typescript
// Fetching for one record
const files = await this.fileService.findByReference(ambulanceId, FileReferenceType.AMBULANCE_DOC);

// Fetching for 100 records (Anti-N+1)
const allFiles = await this.fileService.findByReferences(ids, FileReferenceType.AMBULANCE_DOC);
```

### 🛠️ Best Practices for New Modules
When creating a new module (e.g., `Ambulance`):
1. **Categorize**: Add a new entry to the `FileReferenceType` enum.
2. **Upload**: Use `multerConfig('categoryName')` in your controller to ensure files go to the right folder.
3. **Link**: Pass the `referenceId` (Ambulance ID) to the `FileService` during upload.
4. **Clean**: Implement the `removeByReference` call in your `delete` method to ensure full disk cleanup.

---

## 3. Multi-File Upload & Performance
Uploading many files (like 10 medical reports) at once is handled via `FilesInterceptor`.

### Features:
- **Parallel Processing**: We use `Promise.all` in `FileService` to save all files to disk at the same time, making it much faster than saving them one by one.
- **Bulk Retrieval**: To avoid the **N+1 problem**, we have a `findByReferences` method. It fetches all files for multiple records (e.g., 100 ambulances) in one single database query.

---

## 4. Storage & Static Assets
- **Physical Storage**: Files are saved on disk at `./uploads/{folderName}/`.
- **Automatic Organization**: When you call `multerConfig('userProfile')`, the system checks if that folder exists and creates it automatically if it's missing.
- **Static Access**: In `main.ts`, we've configured NestJS to serve the `uploads/` folder.
  - URL format: `http://localhost:8081/uploads/userProfile/filename.webp`

---

## 5. Security & Best Practices

### Password Protection
- **Storage**: Passwords are hashed with `bcrypt`.
- **Serialization**: We use `@Exclude()` in the User entity and `ClassSerializerInterceptor` in `main.ts`. This ensures that even if you return a `User` object directly, the password is **never** sent to the client.

### Production Middleware
- **Helmet**: Sets security headers to prevent common attacks (XSS, Clickjacking).
- **Compression**: Gzips responses to save bandwidth and make the app load faster for users.
- **ValidationPipe**: Automatically validates incoming data against your DTOs and converts strings to numbers/booleans where expected.

---

## 6. Database Synchronization Error (FIX)
If you see a `QueryFailedError: violates foreign key constraint` in your terminal:

### The Cause:
You have old data in the `users` table where the `profileImg` column was a string. We changed it to a Foreign Key (ID), and TypeORM cannot map your old strings to real File IDs.

### The Fix:
Enable `dropSchema: true` in `app.module.ts` temporarily. This will clear the database and recreate it perfectly with the new relationships.

```typescript
// src/app.module.ts
TypeOrmModule.forRootAsync({
  useFactory: (configService: ConfigService) => ({
    // ...
    dropSchema: true, // Set to true, run app once, then set back to false
    synchronize: true,
  }),
})
```
