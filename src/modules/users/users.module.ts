import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { FileModule } from '../file/file.module';
import { Sessions } from './entities/sessions.entity';
import { SessionsService } from './sessions.service';
import { UserDevice } from './entities/user-device.entity';
import { UsersNotificationOptionsModule } from '../users_notification_options/users_notification_options.module';
import { UserDeviceService } from './user-device.service';
import { UserDeviceController } from './user-device.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Sessions, UserDevice]),
    FileModule,
    UsersNotificationOptionsModule,
  ],
  controllers: [UsersController, UserDeviceController],
  providers: [UsersService, SessionsService,UserDeviceService],
  exports: [UsersService, SessionsService, TypeOrmModule,UserDeviceService],
})
export class UsersModule {}
