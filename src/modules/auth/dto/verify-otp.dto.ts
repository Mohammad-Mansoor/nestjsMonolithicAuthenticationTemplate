import { IsEmail, IsIn, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsIn(['whatsapp', 'email', 'telegram'])
  channel: 'whatsapp' | 'email' | 'telegram';

  @IsString()
  @Length(6, 6)
  otp: string;
}
