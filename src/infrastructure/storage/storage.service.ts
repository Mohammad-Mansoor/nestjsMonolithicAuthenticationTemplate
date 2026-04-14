import { Injectable } from '@nestjs/common';
import { LocalStorageService } from './file.service';
import { IStorageProvider } from './storage.provider.interface';

@Injectable()
export class StorageService implements IStorageProvider {
  constructor(private localStorage: LocalStorageService) {}

  async upload(file: Express.Multer.File) {
    return this.localStorage.save(file);
  }

  async save(file: Express.Multer.File) {
    return this.localStorage.save(file);
  }

  async delete(path: string) {
    return this.localStorage.delete(path);
  }
}