import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile, ParseUUIDPipe, Query } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { FileValidationPipe } from '../../common/pipes/file.validation.pipe';
import { multerConfig } from '../../infrastructure/storage/multer.config';
import { QueryOptionsDto } from 'src/common/dto/query-options.dto';
import { Public } from '../auth/decorators/auth.decorator';
//
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post(':id/profile-image')
  @UseInterceptors(FileInterceptor('file', multerConfig('userProfile')))
  async uploadProfile(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile(new FileValidationPipe({
      allowedMimetypes: ['image/jpeg', 'image/png', 'image/webp'],
      maxSize: 2 * 1024 * 1024 // 2MB
    })) file: Express.Multer.File
  ) {
    return this.usersService.updateProfileImage(id, file);
  }
//


@Public()
  @Post()
  @UseInterceptors(FileInterceptor('file', multerConfig('userProfile')))
  create(
    @Body() createUserDto: CreateUserDto,
    @UploadedFile(new FileValidationPipe({ required: false })) file: Express.Multer.File,
  ) {
    return this.usersService.create(createUserDto, file);
  }


  @Get()
  findAll(@Query() options: QueryOptionsDto) {
    return this.usersService.findAll(options);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }
//
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.remove(id);
  }
}
