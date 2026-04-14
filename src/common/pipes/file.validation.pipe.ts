import {
  PipeTransform,
  Injectable,
  BadRequestException,
} from '@nestjs/common';

interface FileValidationOptions {
  maxSize?: number; // in bytes
  allowedMimetypes?: string[];
  required?: boolean;
}

@Injectable()
export class FileValidationPipe implements PipeTransform {
  constructor(private readonly options: FileValidationOptions = {}) {}

  transform(file: Express.Multer.File | Express.Multer.File[]) {
    if (!file || (Array.isArray(file) && file.length === 0)) {
      if (this.options.required !== false) {
        throw new BadRequestException('File is required');
      }
      return null;
    }

    if (Array.isArray(file)) {
      file.forEach((f) => this.validateFile(f));
      return file;
    }

    this.validateFile(file);
    return file;
  }

  private validateFile(file: Express.Multer.File) {
    // Validate file size (default 5MB)
    const maxSize = this.options.maxSize || 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException(
        `File too large. Maximum size allowed is ${maxSize / (1024 * 1024)}MB`,
      );
    }

    // Validate mime type
    const allowedTypes = this.options.allowedMimetypes || [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
    ];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`,
      );
    }
  }
}
