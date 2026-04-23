import { Injectable, Logger } from '@nestjs/common';
import { RabbitMQService } from 'src/brokers/rabbitmq/rabbitmq.service';
import { Request } from 'express';

export interface AuditLogData {
  module: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'SYSTEM_ACTION';
  recordId: string;
  changes?: Array<{ field: string; old: any; new: any }>;
  message?: string;
  performedByRole?: string;
}

@Injectable()
export class AuditPublisherService {
  private readonly logger = new Logger(AuditPublisherService.name);

  constructor(private readonly rabbitMQService: RabbitMQService) {}

  /**
   * Publishes an audit log event asynchronously via RabbitMQ.
   * This method is fire-and-forget to ensure non-blocking performance.
   * 
   * @param data The audit action details
   * @param req The current request object to extract session and device context
   */
  async publishAuditLog(data: AuditLogData, req?: Request) {
    // 1. Prepare Payload with context from Request (populated by JwtAuthGuard)
    const auditContext = req?.['auditContext'] || {};
    const userContext = (req?.['user'] as any) || {};

    const payload = {
      ...data,
      userId: userContext.userId || 'SYSTEM',
      sessionId: userContext.sessionId,
      requestId: auditContext.requestId,
      ipAddress: auditContext.ipAddress,
      deviceInfo: auditContext.deviceInfo,
      createdAt: new Date().toISOString(),
    };

    // 2. High-Performance Asynchronous Dispatch
    try {
      // Fire-and-forget: No 'await' on the publish itself if we don't need confirmation
      // However, RabbitMQService.publish handles internal confirming via channelWrapper
      this.rabbitMQService.publish(
        'app.events',
        'audit.log',
        payload,
        { persistent: true } // Ensure message survives RMQ restart
      ).catch(err => this.handleFallback(payload, err));

      this.logger.debug(`Audit event [${data.action}] queued for module [${data.module}]`);
    } catch (error) {
      this.handleFallback(payload, error);
    }
  }

  /**
   * Fallback mechanism if RabbitMQ is down.
   * Prevents system failure while ensuring audit data is captured elsewhere.
   */
  private handleFallback(payload: any, error: any) {
    this.logger.error(
      `[AUDIT FALLBACK] RabbitMQ inaccessible. Logging to console to prevent data loss.`,
      JSON.stringify(payload)
    );
    // In a real enterprise app, you might push this to a Redis 'emergency_log' list
    // or a temporary filesystem buffer for later replay.
  }
}
