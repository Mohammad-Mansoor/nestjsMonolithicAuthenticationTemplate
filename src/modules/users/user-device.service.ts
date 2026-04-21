import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { QueryBuilder, Repository } from "typeorm";
import { UserDevice } from "./entities/user-device.entity";
import { RedisCacheService } from "src/common/redis/redis-cache.service";
import { User } from "./entities/user.entity";
import { userDeviceCacheKeys } from "src/common/redis/keys";

@Injectable()
export class UserDeviceService {
    constructor(
        @InjectRepository(UserDevice)
        private readonly userDeviceRepository: Repository<UserDevice>,

        @InjectRepository(User)
        private readonly userRepository: Repository<User>,

        private readonly redisCacheService: RedisCacheService,
    ) {}

    async getSingleUserDevices(userId: string, query:any){
        const cacheKey = userDeviceCacheKeys.USER_BASE_DEVICES(userId, false, query);
        const queryDB = async ()=>{
            const userDevices = await this.userDeviceRepository.createQueryBuilder('userDevice')
            .where('userDevice.userId = :userId', { userId })
            .getMany();
            return userDevices;
        }
        const {data, cached} = await  this.redisCacheService.getOrSet(cacheKey, queryDB);

        return {data, cached, status:"success", message: "User devices fetched successfully"}
    }

    async getSingleDevice (deviceId: string){
        const cacheKey = userDeviceCacheKeys.USER_BASE_DEVICE(deviceId, false);
        const queryDB = async ()=>{
            const userDevice = await this.userDeviceRepository.findOne({ where: { id: deviceId } });


            if(!userDevice){
                throw new Error("User device not found");
            }
            return userDevice;
        }
        const {data, cached} = await  this.redisCacheService.getOrSet(cacheKey, queryDB);

        return {data, cached, status:"success", message: "User device fetched successfully"}
    }

    async getAllDecives (){
        const cacheKey = userDeviceCacheKeys.USERS_DEVICES_LIST(false);
        const queryDB = async ()=>{
            const userDevices = await this.userDeviceRepository.find();
            return userDevices;
        }
        const {data, cached} = await  this.redisCacheService.getOrSet(cacheKey, queryDB);

        return {data:data, cached, status:"success", message: "User devices fetched successfully"}
    }
}