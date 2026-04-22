# File Handling Architecture Guide

The File Handling system in this backend is built with enterprise-grade abstraction. It uses a **Polymorphic Database Strategy** coupled with an **Infrastructure Adapter Pattern**, preventing hard-coupling so that shifting from Local Storage to AWS S3/CloudFlare in the future is virtually effortless.

---

## 1. System Components & Flow

When a user uploads a file, it travels through several specialized layers:

1. **Multer (Express Router)**: First, the physical file bytes are caught by the framework globally or via the `@UploadedFile()` decorator.
2. **`FileValidationPipe`**: Sits directly on the controller. Evaluates the Multer object immediately for `size` restrictions (default 5MB) and `mimetype` spoofing.
3. **`FileService` (Db Layer)**: Creates a single database generic `File` row. It attaches metadata like `originalName` and size, mapping the file uniquely against a `referenceId` and `referenceType`.
4. **`StorageService` (Infrastructure)**: A facade adapter. The DB Service asks the Infrastructure Service to securely save or delete the actual physical disk data.

---

## 2. Abstraction Strategy (How Storage Works)

Located in `src/infrastructure/storage`, the backend specifically separates **Database Logic** from **Hard Drive/Cloud Logic**.

```typescript
// infrastructure/storage/storage.service.ts
@Injectable()
export class StorageService implements IStorageProvider {
  // It currently strictly injects LocalStorageService
  constructor(private localStorage: LocalStorageService) {}
  
  async save(file: Express.Multer.File) {
    return this.localStorage.save(file);
  }
}
```

### 🚀 How to improve it (AWS S3 Migration)
If your load increases and you need to migrate to Amazon S3:
1. Create `s3.service.ts` in `src/infrastructure/storage/`.
2. Make it implement `IStorageProvider` with an `upload` and `delete` method.
3. Swap `localStorage` with `s3Service` inside the `StorageService` constructor above. 

**Zero changes** will be required anywhere else in your entire application codebase!

---

## 3. Polymorphic Relationship Storage

Looking at `src/modules/file/entities/file.entity.ts`, the `File` entity uses advanced polymorphism.
Instead of building `userId`, `patientId`, `receiptId` columns (which scales terribly as the project grows), it uses two universal columns:

- `referenceId` (string/UUID): The ID of the owner.
- `referenceType` (Enum): The type of system module it belongs to (e.g. `USER_PROFILE`, `PATIENT_DOCUMENT`).

Every single file in your massive system lives on one single spreadsheet table, heavily indexed by `referenceId`.

---

## 4. Practical Implementation Guide (For Beginners)

Here is exactly how you handle file uploading inside a brand new module step-by-step.

### Step A: The Controller
Always secure your endpoints using the `FileValidationPipe`. You can customize the `maxSize` explicitly.
```typescript
@Post(':documentId/upload')
@UseInterceptors(FileInterceptor('document')) // Extracts field "document" from FormData
uploadThing(
  @Param('documentId') documentId: string,
  @UploadedFile(new FileValidationPipe({ maxSize: 10 * 1024 * 1024 })) file: Express.Multer.File
) {
  return this.myService.attachFile(documentId, file);
}
```

### Step B: The Service
Always securely map the uploaded file to your exact Module's Reference Enum so another module's file operations never overlap or corrupt yours.
```typescript
import { FileService } from '../../modules/file/file.service';
import { FileReferenceType } from '../../modules/file/enums/file-reference-type.enum';

@Injectable()
export class MyService {
  constructor(private fileService: FileService) {}

  async attachFile(docId: string, file: Express.Multer.File) {
    // 1. Service uploads to physical disk & creates DB row instantly.
    const savedFile = await this.fileService.upload(
      file, 
      docId, 
      FileReferenceType.MY_DOCUMENT_TYPE, // 👈 Register new enums when needed!
      undefined // Can pass logged-in User entity if available
    );

    // 2. Optional: Link the DB ID back to your local entity if mapped directly via @OneToOne
    const myDoc = await this.repo.findOne(docId);
    myDoc.attachmentId = savedFile.id;
    await this.repo.save(myDoc);

    return savedFile;
  }
}
```

### Step C: Safe Deletion
When deleting a User or a Document from the system, you MUST explicitly trigger the `removeByReference` method, otherwise you will cause memory leaks holding onto orphan jpegs on the hard drive.
```typescript
  async deleteDocument(docId: string) {
    // Physically slices all linked documents out of local storage instantly
    await this.fileService.removeByReference(docId, FileReferenceType.MY_DOCUMENT_TYPE);
    
    // Safely remove the document
    await this.repo.delete(docId);
  }
```

> [!WARNING]
> Only ever delete files through `FileService.remove()`. Never delete the entity directly using standard TypeORM injections, or the `StorageService` hook bypasses, crashing your file system space limits over time!
