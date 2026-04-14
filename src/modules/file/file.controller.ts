import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile, UploadedFiles, Query } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { FileService } from './file.service';
import { FileValidationPipe } from '../../common/pipes/file.validation.pipe';
import { multerConfig } from '../../infrastructure/storage/multer.config';
import { FileReferenceType } from './enums/file-reference-type.enum';

@Controller('files')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', multerConfig('documents')))
  async uploadFile(
    @UploadedFile(new FileValidationPipe()) file: Express.Multer.File,
    @Query('refId') refId: string,
    @Query('refType') refType: FileReferenceType,
  ) {
    return this.fileService.upload(file, refId, refType);
  }

  @Post('upload-many')
  @UseInterceptors(FilesInterceptor('files', 10, multerConfig('documents')))
  async uploadFiles(
    @UploadedFiles(new FileValidationPipe()) files: Express.Multer.File[],
    @Query('refId') refId: string,
    @Query('refType') refType: FileReferenceType,
  ) {
    return this.fileService.uploadMany(files, refId, refType);
  }


  @Get()
  findAll() {
    // return this.fileService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return;
    // return this.fileService.findOne(+id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    // return this.fileService.remove(+id);
  }
}

