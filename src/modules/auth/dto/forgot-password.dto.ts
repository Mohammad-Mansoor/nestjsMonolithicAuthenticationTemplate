import { IsEmail, IsIn, IsString } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsIn(['whatsapp', 'email', 'telegram'])
  channel: 'whatsapp' | 'email' | 'telegram';
}
