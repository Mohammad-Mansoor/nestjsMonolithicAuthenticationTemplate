import { Body, Controller, Headers, Post, Req, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import type { Request, Response } from 'express';
import { Public } from './decorators/auth.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

@Public()
  @Post('login')
  async Login(@Body() loginDto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response){
    console.log("login payload: ", loginDto)
    return this.authService.login(loginDto, req, res);
  }

  @Public()
  @Post('refresh-token')
  async refreshToken(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.authService.refreshToken(req, res);
  }
}
