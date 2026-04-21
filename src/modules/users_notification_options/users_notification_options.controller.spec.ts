import { Test, TestingModule } from '@nestjs/testing';
import { UsersNotificationOptionsController } from './users_notification_options.controller';
import { UsersNotificationOptionsService } from './users_notification_options.service';

describe('UsersNotificationOptionsController', () => {
  let controller: UsersNotificationOptionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersNotificationOptionsController],
      providers: [UsersNotificationOptionsService],
    }).compile();

    controller = module.get<UsersNotificationOptionsController>(UsersNotificationOptionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
