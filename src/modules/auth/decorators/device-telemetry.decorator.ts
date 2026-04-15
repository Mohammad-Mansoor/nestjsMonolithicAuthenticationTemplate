import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export interface IDeviceTelemetry {
  fingerprint: string;
  deviceName: string;
  deviceType: string;
  os: string;
  browser: string;
  clientId: string;
}

export const DeviceTelemetry = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): IDeviceTelemetry => {
    const request = ctx.switchToHttp().getRequest<Request>();
    
    return {
      fingerprint: (request.headers['x-fingerprint'] as string) || '',
      deviceName: (request.headers['x-device-name'] as string) || 'Unknown Device',
      deviceType: (request.headers['x-device-type'] as string) || 'Unknown',
      os: (request.headers['x-os'] as string) || 'Unknown',
      browser: (request.headers['x-browser'] as string) || 'Unknown',
      clientId: (request.headers['x-client-id'] as string) || '',
    };
  },
);
