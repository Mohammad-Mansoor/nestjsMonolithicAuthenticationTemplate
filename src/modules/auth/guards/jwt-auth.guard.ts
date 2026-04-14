import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AUTH_TYPE_KEY, AuthType } from '../decorators/auth.decorator';
import { SessionsService } from '../../users/sessions.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly sessionsService: SessionsService,
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Check if route is marked as Public
    const authTypes = this.reflector.getAllAndOverride<AuthType[]>(AUTH_TYPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) ?? [AuthType.Bearer];

    if (authTypes.includes(AuthType.Public)) {
      return true;
    }

    // 2. Extract Token from Headers
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);
    
    if (!token) {
      throw new UnauthorizedException('Authentication token missing');
    }

    try {
      // 3. Verify JWT Signature
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      // 4. DEVICE-LOCK IDENTITY VERIFICATION
      // - Capture the fingerprint (hardware/browser hash)
      // - Capture the deviceId from the persistent security cookie
      const currentFingerprint = this.generateFingerprint(request);
      const persistentDeviceId = request.cookies['device_id'];

      // - Perform strict identity validation
      const session = await this.sessionsService.validateSession(
        payload.sessionId,
        payload.userId,
        persistentDeviceId,
        currentFingerprint
      );

      if (!session) {
        // If the token is valid but used on a different device, it's rejected
        throw new UnauthorizedException('Session is invalid, revoked, or used on an unrecognized device');
      }

      // 5. Attach session data to request object
      request['user'] = {
        userId: payload.userId,
        sessionId: payload.sessionId,
      };
      
      return true;
    } catch (error) {
      throw new UnauthorizedException('Authentication failed: Invalid token');
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  /**
   * Generates a stable hardware fingerprint for the current request.
   * This survives history clears as it relies on browser and OS metadata.
   */
  private generateFingerprint(req: Request): string {
    const userAgent = req.get('user-agent') || '';
    const acceptLang = req.get('accept-language') || '';
    const platform = req.get('sec-ch-ua-platform') || ''; 
    const profile = `${userAgent}|${acceptLang}|${platform}`;
    return crypto.createHash('sha256').update(profile).digest('hex');
  }
}
