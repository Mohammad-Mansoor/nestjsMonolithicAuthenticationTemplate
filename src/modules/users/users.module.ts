import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { FileModule } from '../file/file.module';
import { Sessions } from './entities/sessions.entity';
import { SessionsService } from './sessions.service';
import { UserDevice } from './entities/user-device.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Sessions, UserDevice]), FileModule],
  controllers: [UsersController],
  providers: [UsersService, SessionsService],
  exports: [UsersService, SessionsService, TypeOrmModule],
})
export class UsersModule {}
