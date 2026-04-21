import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { FileReferenceType } from '../enums/file-reference-type.enum';

@Entity('files')
export class File {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  originalName: string;

  @Column()
  fileName: string;

  @Column()
  path: string;

  @Column()
  mimetype: string;

  @Column()
  size: number;

  @Column()
  @Index()
  referenceId: string;

  @Column({
    type: 'enum',
    enum: FileReferenceType,
    default: FileReferenceType.OTHER,
  })
  @Index()
  referenceType: FileReferenceType;

  @ManyToOne(() => User, { nullable: true })
  uploadedBy: User;

  @CreateDateColumn()
  createdAt: Date;
}