import { Test, TestingModule } from '@nestjs/testing';
import { UsersNotificationOptionsService } from './users_notification_options.service';

describe('UsersNotificationOptionsService', () => {
  let service: UsersNotificationOptionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersNotificationOptionsService],
    }).compile();

    service = module.get<UsersNotificationOptionsService>(UsersNotificationOptionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
