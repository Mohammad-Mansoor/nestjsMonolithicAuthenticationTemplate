import { Controller, Get, Param, Query } from '@nestjs/common';
import { UserDeviceService } from './user-device.service';

@Controller('user-device')
export class UserDeviceController {
    constructor(
        private readonly userDeviceService: UserDeviceService,
    ) {}

@Get('/:userId')
async getSingleUserDevices(@Param('userId') userId:string, @Query() query: any){
    return this.userDeviceService.getSingleUserDevices(userId,query);
}

@Get('/:deviceId')
async getSingleDevice(@Param('deviceId') deviceId:string){
    return this.userDeviceService.getSingleDevice(deviceId);
}

@Get('/')
async getAllDecives(){
    return this.userDeviceService.getAllDecives();
}

}
