import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { User } from "./user.entity";

@Entity('sessions')
export class Sessions {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    userId: string;

    @ManyToOne(() => User, (user) => user.sessions, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column()
    refreshToken: string;

    @Column()
    ipAddress: string;

    @Column({ nullable: true })
    userAgent: string;

    @Column({ nullable: true })
    deviceId: string;

    @Column({ nullable: true })
    deviceName: string; // e.g. "iPhone 14 Pro Max"

    @Column({ nullable: true })
    fingerprint: string;


    @Column({ nullable: true })
    deviceType: string;

    @Column({ default: true })
    isValid: boolean;

    @Column({ nullable: true })
    os: string;

    @Column({ nullable: true })
    browser: string;

    @Column()
    expiresAt: Date;

    @Column({ nullable: true })
    lastActiveAt: Date;

    @Column({ nullable: true, default:null })
    logoutAt: Date;

    @Column({ nullable: true, default:null })
    revokedAt: Date;

    @Column({ nullable: true, default:null })
    revokeReason: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
