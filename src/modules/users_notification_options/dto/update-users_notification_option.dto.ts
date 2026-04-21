import { PartialType } from '@nestjs/mapped-types';
import { CreateUsersNotificationOptionDto } from './create-users_notification_option.dto';
import { IsBoolean, IsNotEmpty, IsOptional } from 'class-validator';

export class UpdateUsersNotificationOptionDto extends PartialType(CreateUsersNotificationOptionDto) {
    @IsBoolean()
    @IsOptional()
    email: boolean;

    @IsBoolean()
    @IsOptional()
    whatsapp: boolean;

    @IsBoolean()
    @IsOptional()
    telegram: boolean;

    @IsBoolean()
    @IsOptional()
    inapp: boolean;

    @IsBoolean()
    @IsOptional()
    socket: boolean;
}
