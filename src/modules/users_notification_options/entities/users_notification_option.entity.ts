import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('users_notification_options')
export class UsersNotificationOption {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'userId', nullable: false })
  @Index()
  userId: string;

  @Column({ name: 'email', nullable: false, default: true })
  email: boolean;

  @Column({ name: 'whatsapp', nullable: false, default: true })
  whatsapp: boolean;

  @Column({ name: 'telegram', nullable: false, default: true })
  telegram: boolean;

  @Column({ name: 'inapp', nullable: false, default: true })
  inapp: boolean;

  @Column({ name: 'socket', nullable: false, default: true })
  socket: boolean;

  @OneToOne(() => User, (user) => user.notificationOptions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
