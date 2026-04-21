

import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { Exclude } from 'class-transformer';
import { File } from '../../file/entities/file.entity';
import { Sessions } from './sessions.entity';
import { UsersNotificationOption } from '../../users_notification_options/entities/users_notification_option.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: false })
  @Index()
  firstName: string;

  @Column({ nullable: false })
  @Index()
  lastName: string;

  @Column({ nullable: true, type: 'varchar' })
  @Index()
  whatsappNumber: string | null;

  @Column({ nullable: true, type: 'varchar' })
  @Index()
  telegramUsername: string | null;

  @Column({ nullable: true, type: 'varchar' })
  @Index()
  telegramId: string | null;

  @Column({ nullable: false, select: false })
  @Exclude()
  password: string;


  @OneToOne(() => File, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn()
  profileImage?: File | null;

  @OneToOne(() => UsersNotificationOption, (options) => options.user)
  notificationOptions: UsersNotificationOption;

  @OneToMany(() => Sessions, (session) => session.user)
  sessions: Sessions[];

  @Column({ default: true })
  @Index()
  isActive: boolean;

  @Column({ nullable: true })
  lastLoginAt: Date;

  @Column({ nullable: true })
  lastLoginIp: string;

  @CreateDateColumn()
  @Index()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  lastLogin: Date;
}

