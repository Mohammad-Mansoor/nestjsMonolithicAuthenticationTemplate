import { Express } from 'express';

export interface StorageResponse {
  path: string;
  fileName: string;
}

export interface IStorageProvider {
  save(file: Express.Multer.File): Promise<StorageResponse>;
  delete?(path: string): Promise<void>;
}
