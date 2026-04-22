import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { UsersNotificationOptionsService } from './users_notification_options.service';
import { UpdateUsersNotificationOptionDto } from './dto/update-users_notification_option.dto';

@Controller('users-notification-options')
export class UsersNotificationOptionsController {
  constructor(private readonly service: UsersNotificationOptionsService) {}

  @Post(':userId')
  create(@Param('userId') userId: string) {
    return this.service.createNotificationOption(userId);
  }

  @Get()
  findAll(@Query() query: any) {
    return this.service.findAllUsersNotificationOptions(query);
  }

  @Get(':userId')
  findOne(@Param('userId') userId: string) {
    return this.service.findSingleUserNotificationOptions(userId);
  }

  @Patch(':userId')
  update(
    @Param('userId') userId: string, 
    @Body() dto: UpdateUsersNotificationOptionDto
  ) {
    return this.service.updateUserNotificationOptions(userId, dto);
  }

  @Patch(':userId/whatsapp')
  addWhatsapp(
    @Param('userId') userId: string,
    @Body() data: { whatsappNumber: string }
  ) {
    return this.service.addWhatsappNumber(userId, data);
  }

  @Delete(':userId/whatsapp')
  removeWhatsapp(@Param('userId') userId: string) {
    return this.service.removeWhatsappNumber(userId);
  }

  @Patch(':userId/telegram')
  addTelegram(
    @Param('userId') userId: string,
    @Body() data: { telegramUsername: string; telegramId: string }
  ) {
    return this.service.addTelegramUsername(userId, data);
  }

  @Delete(':userId/telegram')
  removeTelegram(@Param('userId') userId: string) {
    return this.service.removeTelegramUsername(userId);
  }

}
