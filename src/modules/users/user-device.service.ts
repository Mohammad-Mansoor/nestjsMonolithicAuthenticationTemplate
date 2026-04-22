import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UserDevice } from "./entities/user-device.entity";
import { RedisCacheService } from "src/common/redis/redis-cache.service";
import { userDeviceCacheKeys } from "src/common/redis/keys";
import { TypeOrmQueryHelper } from "src/common/helpers/typeorm-query.helper";
import { QueryOptionsDto } from "src/common/dto/query-options.dto";

@Injectable()
export class UserDeviceService {
    constructor(
        @InjectRepository(UserDevice)
        private readonly userDeviceRepository: Repository<UserDevice>,

        private readonly redisCacheService: RedisCacheService,
    ) {}

    /**
     * Fetch devices for a specific user with full query support.
     */
    async findSingleUserDevices(userId: string, options: QueryOptionsDto) {
        const cacheKey = userDeviceCacheKeys.USER_BASE_DEVICES(userId, false, options);
        
        const queryDB = async () => {
            const { data, meta } = await TypeOrmQueryHelper.for(
                this.userDeviceRepository,
                { ...options, userId }, // Inject userId filter into options
                {
                    searchableFields: ['deviceName', 'deviceType', 'browser', 'os', 'userAgent', 'lastIp'],
                    filterableFields: {
                        deviceType: 'deviceType',
                        browser: 'browser',
                        os: 'os',
                        deviceId: 'deviceId',
                        userId: 'userId', // Whitelist userId for filtering
                    },
                    relations: ['user'],
                    defaultSort: 'lastLoginAt:DESC',
                },
                'ud'
            ).getManyAndMeta();
            
            return { data, meta };
        };

        const { data: result, cached } = await this.redisCacheService.getOrSet(cacheKey, queryDB, options);

        return {
            status: "success",
            message: "User devices fetched successfully",
            data: result?.data,
            meta: result?.meta,
            cached
        };
    }

    async findOneDevice(deviceId: string) {
        const cacheKey = userDeviceCacheKeys.USER_BASE_DEVICE(deviceId, false);
        
        const queryDB = async () => {
            const userDevice = await this.userDeviceRepository.findOne({ 
                where: { id: deviceId },
                relations: ['user']
            });

            if (!userDevice) {
                throw new NotFoundException("User device not found");
            }
            return userDevice;
        };

        const { data, cached } = await this.redisCacheService.getOrSet(cacheKey, queryDB);

        return {
            status: "success",
            message: "User device fetched successfully",
            data,
            cached
        };
    }

    async findAllDevices(options: QueryOptionsDto) {
        const cacheKey = userDeviceCacheKeys.USERS_DEVICES_LIST(options, false);
        
        const queryDB = async () => {
            const { data, meta } = await TypeOrmQueryHelper.for(
                this.userDeviceRepository,
                options,
                {
                    searchableFields: ['deviceName', 'deviceType', 'browser', 'os', 'userAgent', 'lastIp'],
                    filterableFields: {
                        deviceType: 'deviceType',
                        browser: 'browser',
                        os: 'os',
                        userId: 'userId',
                    },
                    relations: ['user'],
                    defaultSort: 'lastLoginAt:DESC',
                },
                'ud'
            ).getManyAndMeta();
            
            return { data, meta };
        };

        const { data: result, cached } = await this.redisCacheService.getOrSet(cacheKey, queryDB, options);

        return {
            status: "success",
            message: "User devices fetched successfully",
            data: result?.data,
            meta: result?.meta,
            cached
        };
    }
}