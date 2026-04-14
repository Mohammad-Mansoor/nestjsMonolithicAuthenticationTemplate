// src/modules/file/file.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { File } from './entities/file.entity';
import { FileService } from './file.service';
import { FileController } from './file.controller';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { LocalStorageService } from '../../infrastructure/storage/file.service';

@Module({
  imports: [TypeOrmModule.forFeature([File])],
  controllers: [FileController],
  providers: [FileService, StorageService, LocalStorageService],
  exports: [FileService],
})
export class FileModule {}