import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { AuditPublisherService } from './audit-publisher.service';
import { AuditConsumer } from './audit-consumer.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLog]),
  ],
  providers: [
    AuditPublisherService,
    AuditConsumer,
  ],
  exports: [
    AuditPublisherService,
  ],
})
export class AuditModule {}
