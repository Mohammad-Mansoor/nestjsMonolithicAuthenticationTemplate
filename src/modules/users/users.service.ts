import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { generateSecurePassword } from 'src/common/utils/getRandomPassword';
import { FileService } from '../file/file.service';
import { FileReferenceType } from '../file/enums/file-reference-type.enum';

import { QueryOptionsDto } from 'src/common/dto/query-options.dto';
import { TypeOrmQueryHelper } from 'src/common/helpers/typeorm-query.helper';
import { RedisCacheService } from 'src/common/redis/redis-cache.service';
import { NotificationProducerService } from '../../notifications/notification-producer.service';
import { NotificationEventType } from '../../notifications/notification.events';
import { UsersNotificationOptionsService } from '../users_notification_options/users_notification_options.service';
import { usersCacheKeys } from 'src/common/redis/keys';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly fileService: FileService,
    private readonly redisCacheService: RedisCacheService,
    private readonly notificationService: NotificationProducerService,
    private readonly usersNotificationOptionService: UsersNotificationOptionsService,
  ) {}

  async updateProfileImage(userId: string, file: Express.Multer.File) {
    const cacheKey = usersCacheKeys.USERS_LIST(undefined, true);
    const cacheKeySingle = usersCacheKeys.USERS_SINGLE(userId);
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['profileImage'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // CLEANUP: Unlink and Delete old image
    if (user.profileImage) {
      const oldImageId = user.profileImage.id;
      // 1. Explicitly unlink to avoid FK constraint issues
      user.profileImage = null;
      await this.userRepository.save(user);
      // 2. Delete from DB and Disk
      await this.fileService.remove(oldImageId);
    }

    const savedFile = await this.fileService.upload(
      file,
      userId,
      FileReferenceType.USER_PROFILE,
      user,
    );

    user.profileImage = savedFile;
    const updatedUser = await this.userRepository.save(user);
    await this.redisCacheService.delByPrefix(cacheKey);
    await this.redisCacheService.del(cacheKeySingle);
    return {
      status: 'success',
      message: 'Profile image updated successfully',
      data: updatedUser,
    };
  }

  async createUser(createUserDto: CreateUserDto, file: Express.Multer.File) {
    const cacheKey = usersCacheKeys.USERS_LIST(undefined, true);
    const user = await this.userRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (user) {
      throw new BadRequestException('User already exists');
    }

    const password = generateSecurePassword(8);
    console.log("userpassword😘😘😁😁", password)
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log("hashedPassword😘😘😁😁", hashedPassword)

    const newUser = this.userRepository.create({
      ...createUserDto,
      password: hashedPassword,
    });

    if (file) {
      const savedFile = await this.fileService.upload(
        file,
        'TEMP_ID',
        FileReferenceType.USER_PROFILE,
      );
      newUser.profileImage = savedFile;
    }

    const savedUser = await this.userRepository.save(newUser);

    if (file && newUser.profileImage) {
      newUser.profileImage.referenceId = savedUser.id;
      await this.fileService.updateReferenceId(
        newUser.profileImage.id,
        savedUser.id,
      );
    }

    await this.usersNotificationOptionService.createNotificationOption(savedUser.id);
await this.redisCacheService.delByPrefix(cacheKey);
    await this.notificationService.send({
      type: NotificationEventType.USER_REGISTERED,
      channels: ['email'],
      payload: {
        email: savedUser.email,
        userName: `${savedUser.firstName} ${savedUser.lastName}`,
        emailAddress: savedUser.email,
        temporaryPassword: password,
        supportEmail: 'support@healthsystem.com',
        dashboardLink: 'http://localhost:3000/dashboard'
      }
    });


    return {
      status: 'success',
      message: 'User created successfully',
      data: savedUser,
    };
  }

  async findAllUsers(options: QueryOptionsDto) {
    const cacheKey = usersCacheKeys.USERS_LIST(options);
const queryDB = async ()=>{
  const { data, meta } = await TypeOrmQueryHelper.for(
    this.userRepository,
    options,
    {
      searchableFields: [
        'firstName', 
        'lastName', 
        'email', 
        'whatsappNumber', 
        'profileImage.originalName' // Deep Search: Automatically searches on the joined file name
      ],
      filterableFields: {
        // Exact native mappings
        email: 'email',
        isActive: 'isActive',
        
        // Alias mappings (Frontend sends 'whatsapp', backend filters 'whatsappNumber')
        whatsapp: 'whatsappNumber',
        
        // Deep relation filtering (Frontend sends 'hasInApp', backend filters joined table)
        hasInApp: 'notificationOptions.inapp',
        hasSocket: 'notificationOptions.socket',
        fileName: 'profileImage.originalName',
        imageSize: 'profileImage.size'
      },
      relations: ['profileImage', 'notificationOptions'],
      selectFields: [
        'id',
        'firstName',
        'lastName',
        'email',
        'isActive',
        'createdAt',
        'profileImage.id',
        'profileImage.path',
        'profileImage.originalName',
        'notificationOptions.email',
        'notificationOptions.inapp',
        'notificationOptions.socket',
      ],
      defaultSort: 'isActive:DESC,createdAt:DESC', // By default, shows active users first, then by newest
    },
    'u',
  ).getManyAndMeta();

  return {data, meta};
}

const {data, cached} = await this.redisCacheService.getOrSet(cacheKey, queryDB, options);
   

    return {
      status: 'success',
      message: 'Users fetched successfully',
      data : data?.data,
      meta: data.meta ,
      cached
    };
  }

  async findOneUser(id: string) {

    const cacheKey = usersCacheKeys.USERS_SINGLE(id)
    const queryDB = async ()=>{
      const user = await this.userRepository.findOne({ where: { id } });
      if (!user) {
        throw new NotFoundException('User not found');
      }
      return user;
    }
    const {data, cached} = await this.redisCacheService.getOrSet(cacheKey, queryDB);
   
    return {
      status: 'success',
      message: 'User fetched successfully',
      data: data,
      cached
    };
  }

  async updateUser(id: string, updateUserDto: UpdateUserDto) {
    const cacheKey = usersCacheKeys.USERS_LIST(undefined, true);
    const cacheKeySingle = usersCacheKeys.USERS_SINGLE(id);
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.userRepository.update(id, updateUserDto);
    this.redisCacheService.delByPrefix(cacheKey);
    this.redisCacheService.del(cacheKeySingle);
    return {
      status: 'success',
      message: 'User updated successfully',
      data: user,
    };
  }

  async removeUser(id: string) {
    const cacheKey = usersCacheKeys.USERS_LIST(undefined, true);
    const cacheKeySingle = usersCacheKeys.USERS_SINGLE(id);
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['profileImage'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 1. Unlink and Delete profile image
    if (user.profileImage) {
      const oldImageId = user.profileImage.id;
      user.profileImage = null;
      await this.userRepository.save(user);
      await this.fileService.remove(oldImageId);
    }

    // 2. Delete ALL other files linked to this user
    await this.fileService.removeByReference(id, FileReferenceType.USER_PROFILE);

    // 3. Delete the user record
    await this.userRepository.remove(user);
    this.redisCacheService.delByPrefix(cacheKey);
    this.redisCacheService.del(cacheKeySingle);

    return {
      status: 'success',
      message: 'User and associated files deleted successfully',
    };
  }
}
