import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
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
  referenceId: string;

  @Column({
    type: 'enum',
    enum: FileReferenceType,
    default: FileReferenceType.OTHER,
  })
  referenceType: FileReferenceType;

  @ManyToOne(() => User, { nullable: true })
  uploadedBy: User;

  @CreateDateColumn()
  createdAt: Date;
}