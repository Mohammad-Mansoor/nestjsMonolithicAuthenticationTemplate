import { 
  Injectable, 
  NotFoundException, 
  ConflictException, 
  BadRequestException 
} from '@nestjs/common';
import { UpdateUsersNotificationOptionDto } from './dto/update-users_notification_option.dto';
import { RedisCacheService } from 'src/common/redis/redis-cache.service';
import { usersNotificationCacheKeys, usersCacheKeys } from 'src/common/redis/keys';
import { InjectRepository } from '@nestjs/typeorm';
import { UsersNotificationOption } from './entities/users_notification_option.entity';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { TypeOrmQueryHelper } from 'src/common/helpers/typeorm-query.helper';
import { QueryOptionsDto } from 'src/common/dto/query-options.dto';

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
    
    // Invalidate List Prefixes
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

      await manager.update(User, userId, { whatsappNumber: data.whatsappNumber });
      await manager.update(UsersNotificationOption, options.id, { whatsapp: true });

      // Invalidate Both Entities Caches
      await this.redisService.del(usersCacheKeys.USERS_SINGLE(userId));
      await this.redisService.delByPrefix(usersCacheKeys.USERS_LIST({}, true));
      await this.redisService.del(usersNotificationCacheKeys.USER_NOTIFICATION_OPTIONS(userId));
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

      await manager.update(User, userId, { whatsappNumber: null });
      await manager.update(UsersNotificationOption, options.id, { whatsapp: false });

      // Invalidate Both Entities Caches
      await this.redisService.del(usersCacheKeys.USERS_SINGLE(userId));
      await this.redisService.delByPrefix(usersCacheKeys.USERS_LIST({}, true));
      await this.redisService.del(usersNotificationCacheKeys.USER_NOTIFICATION_OPTIONS(userId));
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

      await manager.update(User, userId, { 
        telegramUsername: data.telegramUsername, 
        telegramId: data.telegramId 
      });
      await manager.update(UsersNotificationOption, options.id, { telegram: true });

      // Invalidate Both Entities Caches
      await this.redisService.del(usersCacheKeys.USERS_SINGLE(userId));
      await this.redisService.delByPrefix(usersCacheKeys.USERS_LIST({}, true));
      await this.redisService.del(usersNotificationCacheKeys.USER_NOTIFICATION_OPTIONS(userId));
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

      await manager.update(User, userId, { telegramUsername: null, telegramId: null });
      await manager.update(UsersNotificationOption, options.id, { telegram: false });

      // Invalidate Both Entities Caches
      await this.redisService.del(usersCacheKeys.USERS_SINGLE(userId));
      await this.redisService.delByPrefix(usersCacheKeys.USERS_LIST({}, true));
      await this.redisService.del(usersNotificationCacheKeys.USER_NOTIFICATION_OPTIONS(userId));
      await this.redisService.delByPrefix(usersNotificationCacheKeys.USER_NOTIFICATION_OPTIONS_LIST({}, true));

      return { status: "success", message: `User Telegram identity removed successfully` };
    });
  }

  /**
   * Manual bulk update of notification channel preferences.
   */
  async updateUserNotificationOptions(userId: string, data: UpdateUsersNotificationOptionDto) {
    const cacheKey = usersNotificationCacheKeys.USER_NOTIFICATION_OPTIONS(userId);
    const cacheKeyList = usersNotificationCacheKeys.USER_NOTIFICATION_OPTIONS_LIST({}, true);

    const options = await this.usersNotificationOptionRepository.findOne({ where: { userId } });
    if (!options) throw new NotFoundException('User notification options not found');

    await this.usersNotificationOptionRepository.update(options.id, data);
    
    // Invalidate Cache
    await this.redisService.del(cacheKey);
    await this.redisService.delByPrefix(cacheKeyList);

    return { 
      status: "success", 
      message: `User notification preferences updated successfully`,
      data: { ...options, ...data }
    };
  }

  /**
   * Retrieves all notification options with cache support.
   */
  async findAllUsersNotificationOptions(options: QueryOptionsDto) {
    const cacheKey = usersNotificationCacheKeys.USER_NOTIFICATION_OPTIONS_LIST(options);
    const queryDB = async () => {
      const { data, meta } = await TypeOrmQueryHelper.for(
        this.usersNotificationOptionRepository,
        options,
        {
          searchableFields: ['user.firstName', 'user.lastName', 'user.email'],
          filterableFields: {
            email: 'email',
            whatsapp: 'whatsapp',
            telegram: 'telegram',
            inapp: 'inapp',
            socket: 'socket',
            userId: 'userId',
          },
          relations: ['user'],
          selectFields: [
            'id',
            'userId',
            'email',
            'whatsapp',
            'telegram',
            'inapp',
            'socket',
            'user.id',
            'user.firstName',
            'user.lastName',
            'user.email',
          ],
          defaultSort: 'id:DESC',
        },
        'uno'
      ).getManyAndMeta();
      return { data, meta };
    };

    const { data: result, cached } = await this.redisService.getOrSet(cacheKey, queryDB, options);
    
    return {
      status: "success",
      message: `User notification options fetched successfully`,
      data: result?.data,
      meta: result?.meta,
      cache: cached
    };
  }

  /**
   * Retrieves single user notification options with cache support.
   */
  async findSingleUserNotificationOptions(userId: string) {
    const cacheKey = usersNotificationCacheKeys.USER_NOTIFICATION_OPTIONS(userId);
    const queryDB = async () => {
      const option  = await this.usersNotificationOptionRepository.findOne({ where: { userId } });
      if(!option){
        throw new NotFoundException("Notification Option Not Found!")
      }
      return option
    };

    const { data, cached } = await this.redisService.getOrSet(cacheKey, queryDB, { userId });
    return {
      status: "success",
      message: `User notification option fetched successfully`,
      data,
      cache: cached
    };
  }


}
