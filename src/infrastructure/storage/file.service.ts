import { Injectable } from '@nestjs/common';
import { IStorageProvider, StorageResponse } from './storage.provider.interface';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class LocalStorageService implements IStorageProvider {
  async save(file: Express.Multer.File): Promise<StorageResponse> {
    return {
      path: file.path,
      fileName: file.filename,
    };
  }

  async delete(filePath: string): Promise<void> {
    const fullPath = path.resolve(filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }
}