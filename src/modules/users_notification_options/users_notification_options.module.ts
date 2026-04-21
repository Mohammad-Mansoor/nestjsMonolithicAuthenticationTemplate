import { Module } from '@nestjs/common';
import { UsersNotificationOptionsService } from './users_notification_options.service';
import { UsersNotificationOptionsController } from './users_notification_options.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersNotificationOption } from './entities/users_notification_option.entity';
import { User } from '../users/entities/user.entity';
import { RedisCacheModule } from 'src/common/redis/redis-cache.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UsersNotificationOption, User]),
    RedisCacheModule,
  ],
  controllers: [UsersNotificationOptionsController],
  providers: [UsersNotificationOptionsService],
  exports: [UsersNotificationOptionsService],
})
export class UsersNotificationOptionsModule {}
