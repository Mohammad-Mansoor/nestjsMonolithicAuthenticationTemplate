import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { File } from './entities/file.entity';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { FileReferenceType } from './enums/file-reference-type.enum';
import { User } from '../users/entities/user.entity';
import { TypeOrmQueryHelper } from 'src/common/helpers/typeorm-query.helper';
import { RedisCacheService } from 'src/common/redis/redis-cache.service';
import { fileCacheKeys } from 'src/common/redis/keys';
import { QueryOptionsDto } from 'src/common/dto/query-options.dto';

@Injectable()
export class FileService {
  constructor(
    @InjectRepository(File)
    private fileRepo: Repository<File>,
    private storageService: StorageService,
    private redisCacheService: RedisCacheService,
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
    const file = await this.fileRepo.findOne({ 
      where: { id: fileId },
      relations: ['uploadedBy']
    });

    if (file) {
      const uploaderId = file.uploadedBy?.id;
      await this.storageService.delete(file.path);
      await this.fileRepo.remove(file);

      // Invalidate Cache
      if (uploaderId) {
        await this.redisCacheService.delByPrefix(fileCacheKeys.USER_FILES(uploaderId, {}, true));
      }
      await this.redisCacheService.delByPrefix(fileCacheKeys.FILES_LIST({}, true));
      await this.redisCacheService.del(fileCacheKeys.FILE_SINGLE(fileId));
    }
  }

  async removeByReference(referenceId: string, referenceType: FileReferenceType) {
    const files = await this.findByReference(referenceId, referenceType);
    const deletePromises = files.map((file) => this.remove(file.id));
    await Promise.all(deletePromises);
  }

  /**
   * Fetches files uploaded by a specific user with advanced filtering and caching.
   */
  async getFilesByUploaderId(uploaderId: string, options: QueryOptionsDto) {
    const cacheKey = fileCacheKeys.USER_FILES(uploaderId, options);

    const queryDB = async () => {
      const { data, meta } = await TypeOrmQueryHelper.for(
        this.fileRepo,
        { ...options, uploadedBy: uploaderId },
        {
          searchableFields: [
            'originalName',
            'fileName',
            'mimetype',
            'referenceId',
            'referenceType',
            'uploadedBy.firstName',
            'uploadedBy.lastName',
            'uploadedBy.email',
          ],
          filterableFields: {
            originalName: 'originalName',
            fileName: 'fileName',
            mimetype: 'mimetype',
            referenceId: 'referenceId',
            referenceType: 'referenceType',
            uploadedBy: 'uploadedBy',
          },
          relations: ['uploadedBy'],
          selectFields: [
            'id',
            'originalName',
            'fileName',
            'path',
            'mimetype',
            'size',
            'referenceId',
            'referenceType',
            'uploadedBy.id',
            'uploadedBy.firstName',
            'uploadedBy.lastName',
            'uploadedBy.email',
          ],
          defaultSort: 'createdAt:DESC',
        },
        "file"
      ).getManyAndMeta();
      
      return { data, meta };
    };

    const { data: result, cached } = await this.redisCacheService.getOrSet(cacheKey, queryDB, options);

    return { 
      status: 'success', 
      message: 'Files fetched successfully', 
      data: result?.data,
      meta: result?.meta,
      cached 
    };
  }


}

