import { 
  Injectable, 
  NotFoundException, 
  ConflictException, 
  BadRequestException 
} from '@nestjs/common';
import { UpdateUsersNotificationOptionDto } from './dto/update-users_notification_option.dto';
import { RedisCacheService } from 'src/common/redis/redis-cache.service';
import { usersNotificationCacheKeys } from 'src/common/redis/keys';
import { InjectRepository } from '@nestjs/typeorm';
import { UsersNotificationOption } from './entities/users_notification_option.entity';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';

@Injectable()
export class UsersNotificationOptionsService {
  constructor(
    private readonly redisService: RedisCacheService,
    @InjectRepository(UsersNotificationOption)
    private readonly usersNotificationOptionRepository: Repository<UsersNotificationOption>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Initializes notification options for a new user.
   */
  async createNotificationOption(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId, isActive: true } });
    if (!user) throw new NotFoundException('Active user not found');

    const existing = await this.usersNotificationOptionRepository.findOne({ where: { userId } });
    if (existing) throw new ConflictException('User notification options already exist');

    const userNotificationOption = this.usersNotificationOptionRepository.create({
      userId,
      email: true,
      whatsapp: false,
      telegram: false,
      inapp: false,
      socket: true,
    });

    await this.usersNotificationOptionRepository.save(userNotificationOption);
    await this.redisService.delByPrefix(usersNotificationCacheKeys.USER_NOTIFICATION_OPTIONS_LIST({}, true));

    return {
      status: "success",
      message: 'User notification options created successfully',
      data: userNotificationOption
    };
  }

  /**
   * Updates WhatsApp number and enables WhatsApp notifications atomically.
   */
  async addWhatsappNumber(userId: string, data: { whatsappNumber: string }) {
    if (!data.whatsappNumber) throw new BadRequestException('WhatsApp number is required');

    return await this.userRepository.manager.transaction(async (manager) => {
      const user = await manager.findOne(User, { where: { id: userId, isActive: true } });
      if (!user) throw new NotFoundException('Active user not found');

      const options = await manager.findOne(UsersNotificationOption, { where: { userId } });
      if (!options) throw new NotFoundException('User notification options not found');

      user.whatsappNumber = data.whatsappNumber;
      await manager.save(user);

      options.whatsapp = true;
      await manager.save(options);

      await this.redisService.delByPrefix(usersNotificationCacheKeys.USER_NOTIFICATION_OPTIONS(userId));
      await this.redisService.delByPrefix(usersNotificationCacheKeys.USER_NOTIFICATION_OPTIONS_LIST({}, true));

      return { status: "success", message: `User WhatsApp number updated successfully` };
    });
  }

  /**
   * Removes WhatsApp number and disables WhatsApp notifications atomically.
   */
  async removeWhatsappNumber(userId: string) {
    return await this.userRepository.manager.transaction(async (manager) => {
      const user = await manager.findOne(User, { where: { id: userId, isActive: true } });
      if (!user) throw new NotFoundException('Active user not found');

      const options = await manager.findOne(UsersNotificationOption, { where: { userId } });
      if (!options) throw new NotFoundException('User notification options not found');

      user.whatsappNumber = null;
      await manager.save(user);

      options.whatsapp = false;
      await manager.save(options);

      await this.redisService.delByPrefix(usersNotificationCacheKeys.USER_NOTIFICATION_OPTIONS(userId));
      await this.redisService.delByPrefix(usersNotificationCacheKeys.USER_NOTIFICATION_OPTIONS_LIST({}, true));

      return { status: "success", message: `User WhatsApp number removed successfully` };
    });
  }

  /**
   * Updates Telegram username/ID and enables Telegram notifications atomically.
   */
  async addTelegramUsername(userId: string, data: { telegramUsername: string; telegramId: string }) {
    if (!data.telegramUsername || !data.telegramId) {
      throw new BadRequestException('Telegram username and ID are required');
    }

    return await this.userRepository.manager.transaction(async (manager) => {
      const user = await manager.findOne(User, { where: { id: userId, isActive: true } });
      if (!user) throw new NotFoundException('Active user not found');

      const options = await manager.findOne(UsersNotificationOption, { where: { userId } });
      if (!options) throw new NotFoundException('User notification options not found');

      user.telegramUsername = data.telegramUsername;
      user.telegramId = data.telegramId;
      await manager.save(user);

      options.telegram = true;
      await manager.save(options);

      await this.redisService.delByPrefix(usersNotificationCacheKeys.USER_NOTIFICATION_OPTIONS(userId));
      await this.redisService.delByPrefix(usersNotificationCacheKeys.USER_NOTIFICATION_OPTIONS_LIST({}, true));

      return { status: "success", message: `User Telegram identity updated successfully` };
    });
  }

  /**
   * Removes Telegram identity and disables Telegram notifications atomically.
   */
  async removeTelegramUsername(userId: string) {
    return await this.userRepository.manager.transaction(async (manager) => {
      const user = await manager.findOne(User, { where: { id: userId, isActive: true } });
      if (!user) throw new NotFoundException('Active user not found');

      const options = await manager.findOne(UsersNotificationOption, { where: { userId } });
      if (!options) throw new NotFoundException('User notification options not found');

      user.telegramUsername = null;
      user.telegramId = null;
      await manager.save(user);

      options.telegram = false;
      await manager.save(options);

      await this.redisService.delByPrefix(usersNotificationCacheKeys.USER_NOTIFICATION_OPTIONS(userId));
      await this.redisService.delByPrefix(usersNotificationCacheKeys.USER_NOTIFICATION_OPTIONS_LIST({}, true));

      return { status: "success", message: `User Telegram identity removed successfully` };
    });
  }

  /**
   * Manual bulk update of notification channel preferences.
   */
  async updateUserNotificationOptions(userId: string, data: UpdateUsersNotificationOptionDto) {
    const user = await this.userRepository.findOne({ where: { id: userId, isActive: true } });
    if (!user) throw new NotFoundException('Active user not found');

    const options = await this.usersNotificationOptionRepository.findOne({ where: { userId } });
    if (!options) throw new NotFoundException('User notification options not found');

    Object.assign(options, data);
    await this.usersNotificationOptionRepository.save(options);

    await this.redisService.delByPrefix(usersNotificationCacheKeys.USER_NOTIFICATION_OPTIONS(userId));
    await this.redisService.delByPrefix(usersNotificationCacheKeys.USER_NOTIFICATION_OPTIONS_LIST({}, true));

    return { 
      status: "success", 
      message: `User notification preferences updated successfully`, 
      data: options 
    };
  }

  /**
   * Retrieves all notification options with cache support.
   */
  async findAllUsersNotificationOptions(query: any) {
    const cacheKey = usersNotificationCacheKeys.USER_NOTIFICATION_OPTIONS_LIST(query);
    const queryDB = async () => {
      return await this.usersNotificationOptionRepository.find({
        where: query,
        relations: ['user'],
      });
    };

    const { data, cached } = await this.redisService.getOrSet(cacheKey, queryDB, query);
    return {
      status: "success",
      message: `User notification options fetched successfully`,
      data,
      cache: cached
    };
  }

  /**
   * Retrieves single user notification options with cache support.
   */
  async findSingleUserNotificationOptions(userId: string) {
    const cacheKey = usersNotificationCacheKeys.USER_NOTIFICATION_OPTIONS(userId);
    const queryDB = async () => {
      return await this.usersNotificationOptionRepository.findOne({ where: { userId } });
    };

    const { data, cached } = await this.redisService.getOrSet(cacheKey, queryDB, {});
    return {
      status: "success",
      message: `User notification option fetched successfully`,
      data,
      cache: cached
    };
  }

  update(id: number, updateUsersNotificationOptionDto: UpdateUsersNotificationOptionDto) {
    return `This action updates a #${id} usersNotificationOption`;
  }

  remove(id: number) {
    return `This action removes a #${id} usersNotificationOption`;
  }
}
