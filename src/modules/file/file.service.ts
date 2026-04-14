import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { File } from './entities/file.entity';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { FileReferenceType } from './enums/file-reference-type.enum';
import { User } from '../users/entities/user.entity';

@Injectable()
export class FileService {
  constructor(
    @InjectRepository(File)
    private fileRepo: Repository<File>,
    private storageService: StorageService,
  ) {}

  async upload(
    file: Express.Multer.File,
    referenceId: string,
    referenceType: FileReferenceType,
    uploadedBy?: User,
  ) {
    const stored = await this.storageService.upload(file);

    const fileEntity = this.fileRepo.create({
      originalName: file.originalname,
      fileName: stored.fileName,
      path: stored.path,
      mimetype: file.mimetype,
      size: file.size,
      referenceId,
      referenceType,
      uploadedBy,
    });

    return this.fileRepo.save(fileEntity);
  }

  async uploadMany(
    files: Express.Multer.File[],
    referenceId: string,
    referenceType: FileReferenceType,
    uploadedBy?: User,
  ) {
    const uploadPromises = files.map((file) =>
      this.upload(file, referenceId, referenceType, uploadedBy),
    );
    return Promise.all(uploadPromises);
  }

  async updateReferenceId(fileId: number, referenceId: string) {
    return this.fileRepo.update(fileId, { referenceId });
  }

  async findByReference(referenceId: string, referenceType: FileReferenceType) {
    return this.fileRepo.find({
      where: { referenceId, referenceType },
    });
  }

  async findByReferences(
    referenceIds: string[],
    referenceType: FileReferenceType,
  ) {
    return this.fileRepo.find({
      where: {
        referenceId: In(referenceIds),
        referenceType,
      },
    });
  }

  async remove(fileId: number) {
    const file = await this.fileRepo.findOne({ where: { id: fileId } });
    if (file) {
      await this.storageService.delete(file.path);
      await this.fileRepo.remove(file);
    }
  }

  async removeByReference(referenceId: string, referenceType: FileReferenceType) {
    const files = await this.findByReference(referenceId, referenceType);
    const deletePromises = files.map((file) => this.remove(file.id));
    await Promise.all(deletePromises);
  }
}
