import { IsEmail, IsString, MinLength } from 'class-validator';

export class CompleteResetDto {
  @IsEmail()
  email: string;

  @IsString()
  resetToken: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}
