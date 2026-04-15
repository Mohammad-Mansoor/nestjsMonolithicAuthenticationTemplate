import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { IsNull, Repository } from 'typeorm';
import { Sessions } from '../users/entities/sessions.entity';
import { RedisCacheService } from 'src/common/redis/redis-cache.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { Request, Response } from 'express';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { SessionsService } from '../users/sessions.service';
import { sessionCacheKeys } from 'src/common/redis/keys';
import { UserDevice } from '../users/entities/user-device.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Sessions)
    private readonly sessionsRepository: Repository<Sessions>,
    @InjectRepository(UserDevice)
    private readonly userDeviceRepository: Repository<UserDevice>,
    private readonly redisCacheService: RedisCacheService,
    private readonly sessionsService: SessionsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(loginDto: LoginDto, req: Request, res: Response) {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email: loginDto.email })
      .andWhere('user.isActive = :isActive', { isActive: true })
      .getOne();

    if (!user) {
      throw new BadRequestException('Invalid Credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new BadRequestException('Invalid Credentials');
    }

    const sessionId = uuidv4();

    // --- ADVANCED DEVICE IDENTITY LOGIC ---
    const persistentDeviceIdFromCookie = req.cookies['device_id'];
    const currentFingerprint = (req.headers['x-fingerprint'] as string) || this.generateFingerprint(req);
    const incomingDeviceName = req.headers['x-device-name'] as string;
    const incomingDeviceType = req.headers['x-device-type'] as string;
    const incomingOs = req.headers['x-os'] as string;
    const incomingBrowser = req.headers['x-browser'] as string;
    // Check if this is a known device for this user
    let knownDevice = await this.userDeviceRepository.findOne({
      where: [
        { userId: user.id, deviceId: persistentDeviceIdFromCookie },
        { userId: user.id, fingerprint: currentFingerprint }
      ]
    });

    if (!knownDevice) {
      // TODO: SEND EMAIL NOTIFICATION HERE
      // Google-like alert: "New login from [Browser] on [OS] at [IP]"
      console.log('--- SECURITY ALERT: NEW DEVICE DETECTED! ---');
      
      const newDeviceId = uuidv4();
      knownDevice = this.userDeviceRepository.create({
        userId: user.id,
        deviceId: newDeviceId,
        fingerprint: currentFingerprint,
        deviceName: incomingDeviceName,
        deviceType: incomingDeviceType || this.getDeviceType(req.get('user-agent') || ''),
        userAgent: req.get('user-agent') || '',
        browser: incomingBrowser || this.getBrowser(req.get('user-agent') || ''),
        os: incomingOs || this.getOS(req.get('user-agent') || ''),
        lastIp: req.ip || '',
        lastLoginAt: new Date(),
      });
      await this.userDeviceRepository.save(knownDevice);
    } else {
      // Existing device: Update its stats
      knownDevice.lastIp = req.ip || '';
      knownDevice.lastLoginAt = new Date();
      knownDevice.fingerprint = currentFingerprint; // Update fingerprint in case of browser updates
      knownDevice.deviceName = incomingDeviceName || knownDevice.deviceName;
      knownDevice.deviceType = incomingDeviceType || knownDevice.deviceType || this.getDeviceType(req.get('user-agent') || '');
      knownDevice.browser = incomingBrowser || knownDevice.browser || this.getBrowser(req.get('user-agent') || '');
      knownDevice.os = incomingOs || knownDevice.os || this.getOS(req.get('user-agent') || '');
      await this.userDeviceRepository.save(knownDevice);
    }
    // ----------------------------------------

    const sessionPayload = {
      id: sessionId,
      ...this.prepareSessionData(user.id, sessionId, knownDevice.deviceId, req),
    };

    const session = await this.sessionsService.createSession(sessionPayload);
    const accessToken = this.generateAccessToken(user.id, session.id);

    // 1. Refresh Token Cookie
    res.cookie('refresh_token', session.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/auth/refresh-token',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // 2. Persistent Device ID Cookie (1 Year)
    res.cookie('device_id', knownDevice.deviceId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 365 * 24 * 60 * 60 * 1000, 
    });

    return { message: 'Login successful', accessToken: accessToken };
  }

  async refreshToken(req: Request, res: Response) {
    const oldRefreshToken = req.cookies['refresh_token'];
    const persistentDeviceId = req.cookies['device_id']; // Using persistent security cookie
    const currentFingerprint = (req.headers['x-fingerprint'] as string) || this.generateFingerprint(req);

    if (!oldRefreshToken) {
      throw new UnauthorizedException('Refresh token missing');
    }

    const session = await this.sessionsRepository.findOne({
      where: { refreshToken: oldRefreshToken },
      relations: ['user'],
    });

    if (!session) {
      throw new UnauthorizedException('Token invalid or already rotated');
    }

    // --- ADVANCED IDENTITY VERIFICATION ---
    // 1. Fetch the UserDevice associated with this session
    const knownDevice = await this.userDeviceRepository.findOne({
      where: { deviceId: session.deviceId, userId: session.userId }
    });

    // 2. The Identity Check: Cookie Match OR Fingerprint Match
    const isCookieMatched = persistentDeviceId === session.deviceId;
    const isFingerprintMatched = knownDevice && knownDevice.fingerprint === currentFingerprint;
    const isExpired = new Date() > session.expiresAt;

    if (!session.isValid || isExpired || (!isCookieMatched && !isFingerprintMatched)) {
      await this.sessionsService.invalidateSession(
        session.id,
        session.userId,
        'Suspicious refresh attempt: Unrecognized device identity',
      );
      throw new UnauthorizedException('Session compromised or identity unverified');
    }
    // ----------------------------------------

    const newRefreshToken = this.generateRefreshToken();
    const newAccessToken = this.generateAccessToken(session.userId, session.id);
    session.refreshToken = newRefreshToken;
    session.lastActiveAt = new Date();
    await this.sessionsRepository.save(session);
    

    await this.redisCacheService.del(sessionCacheKeys.USER_SINGLE_SESSION(session.userId, session.id));


    res.cookie('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/auth/refresh-token',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return { message: 'Token rotated successfully', accessToken: newAccessToken };
  }

  async logoutSingleSession(req: Request, res: Response) {
    const user:any = req.user;

    const userDetails = await this.userRepository.findOne({where: {id: user.userId, isActive:true}})
    
    if(!userDetails){
      throw new BadRequestException('User not found');
    }

    const session = await this.sessionsService.invalidateSession(user.sessionId, user.userId, 'Logout by user');
    if(!session){
      throw new BadRequestException("Session not found")
    }
    res.clearCookie('refresh_token');
    //if you want to make the device unknown on logout you can uncomment the below line
    // res.clearCookie('device_id');
    
    return {status:"success", message: 'User Logout Successfully' };
  }

  async logoutAllSessions(req: Request, res: Response){
    const user:any = req.user;

    const userDetails = await this.userRepository.findOne({where: {id: user.userId, isActive:true}})
    
    if(!userDetails){
      throw new BadRequestException('User not found');
    }

    const session:Sessions[] | null = await this.sessionsService.invalidateAllSessions(user.userId, 'Logout all sessions by user');
    if(!session || !session.length){
      throw new BadRequestException("No active sessions found")
    }
    res.clearCookie('refresh_token');
    
    return {status:"success", message: 'User Logout from all Sessions Successfully' };
  }

  async logoutOtherSessions(req: Request, res: Response){
    const user:any = req.user;

    const userDetails = await this.userRepository.findOne({where: {id: user.userId, isActive:true}})
    
    if(!userDetails){
      throw new BadRequestException('User not found');
    }

    const session:Sessions[] | null = await this.sessionsService.invalidOtherSessions(user.userId, user.sessionId, 'Logout other sessions by user');
    if(!session || !session.length){
      throw new BadRequestException("No other active sessions found")
    }
    
    return {status:"success", message: 'User Logout from other Sessions Successfully' };
  }

  private generateRefreshToken(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  private generateAccessToken(userId: string, sessionId: string): string {
    return this.jwtService.sign({ userId, sessionId });
  }

  private getDeviceType(userAgent: string): string {
    if (
      /Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(
        userAgent,
      )
    ) {
      return 'Mobile';
    }
    return 'Desktop';
  }

  private getBrowser(userAgent: string): string {
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Unknown';
  }

  private getOS(userAgent: string): string {
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Mac')) return 'Mac OS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iOS')) return 'iOS';
    return 'Unknown';
  }

  private generateFingerprint(req: Request): string {
    const userAgent = req.get('user-agent') || '';
    const acceptLang = req.get('accept-language') || '';
    const platform = req.get('sec-ch-ua-platform') || ''; // Modern browser hint
    
    // Create a stable profile string
    const profile = `${userAgent}|${acceptLang}|${platform}`;
    
    return crypto.createHash('sha256').update(profile).digest('hex');
  }

  private generateDeviceId(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private prepareSessionData(
    userId: string,
    sessionId: string,
    deviceId: string,
    req: Request,
  ): Partial<Sessions> {
    const userAgent = req.get('user-agent') || '';
    const incomingDeviceName = req.headers['x-device-name'] as string;
    const incomingDeviceType = req.headers['x-device-type'] as string;
    const incomingOs = req.headers['x-os'] as string;
    const incomingBrowser = req.headers['x-browser'] as string;
    const incomingFingerprint = (req.headers['x-fingerprint'] as string) || this.generateFingerprint(req);

    return {
      id: sessionId,
      userId,
      ipAddress: req.ip,
      userAgent,
      browser: incomingBrowser || this.getBrowser(userAgent),
      os: incomingOs || this.getOS(userAgent),
      deviceId: deviceId, // Using the persistent deviceId now
      deviceName: incomingDeviceName,
      fingerprint: incomingFingerprint,
      deviceType: incomingDeviceType || this.getDeviceType(userAgent),
      refreshToken: this.generateRefreshToken(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      lastActiveAt: new Date(),
      isValid: true,
    };
  }
}
