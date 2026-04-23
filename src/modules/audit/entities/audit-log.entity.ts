import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  @Index()
  userId: string;

  @Column({ nullable: true })
  performedByRole: string; // Snapshot of role at time of action

  @Column()
  @Index()
  module: string; // e.g. "User", "Order", "File"

  @Column()
  @Index()
  recordId: string; // ID of the entity being acted upon

  @Column()
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT';

  @Column({ type: 'jsonb', nullable: true })
  changes: Array<{ field: string; old: any; new: any }>;

  @Column({ nullable: true })
  message: string; // Human-readable message

  @Column({ nullable: true })
  sessionId: string;

  @Column({ type: 'jsonb', nullable: true })
  deviceInfo: {
    browser?: string;
    os?: string;
    deviceType?: string;
    deviceName?: string;
  };

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ nullable: true })
  @Index()
  requestId: string; // For tracing end-to-end flow

  @CreateDateColumn()
  @Index()
  createdAt: Date;
}
