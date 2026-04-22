import { Controller, Get, Param, Query } from '@nestjs/common';
import { UserDeviceService } from './user-device.service';

@Controller('user-device')
export class UserDeviceController {
    constructor(
        private readonly userDeviceService: UserDeviceService,
    ) {}

@Get('user/:userId')
async findSingleUserDevices(
    @Param('userId') userId: string, 
    @Query() options: Record<string, any>
) {
    return this.userDeviceService.findSingleUserDevices(userId, options);
}

@Get(':deviceId')
async findOneDevice(@Param('deviceId') deviceId: string) {
    return this.userDeviceService.findOneDevice(deviceId);
}

@Get()
async findAllDevices(@Query() options: Record<string, any>) {
    return this.userDeviceService.findAllDevices(options);
}

}
