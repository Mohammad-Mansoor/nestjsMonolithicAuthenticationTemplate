import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('user_devices')
export class UserDevice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  deviceId: string; // The long-lived persistent identifier (UUID)

  @Column({ nullable: true })
  deviceName: string; // e.g. "iPhone 14 Pro Max"

  @Column({ nullable: true })
  deviceType: string; // e.g. "Mobile", "Desktop"

  @Column()
  fingerprint: string; // Hashed browser/hardware profile

  @Column({ nullable: true })
  userAgent: string;

  @Column({ nullable: true })
  browser: string;

  @Column({ nullable: true })
  os: string;

  @Column({ nullable: true })
  lastIp: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  lastLoginAt: Date;
}
