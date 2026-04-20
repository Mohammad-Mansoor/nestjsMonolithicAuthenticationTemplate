import { Body, Controller, Get, Headers, Post, Req, Res } from '@nestjs/common';
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

  @Get('me')
  async me(@Req() req: Request) {
    return this.authService.getMe(req);
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.authService.logoutSingleSession(req, res);
  }

  @Post('logout-all')
  async logoutAll(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.authService.logoutAllSessions(req, res);
  }

  @Post('logout-other')
  async logoutOther(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.authService.logoutOtherSessions(req, res);
  }
}
