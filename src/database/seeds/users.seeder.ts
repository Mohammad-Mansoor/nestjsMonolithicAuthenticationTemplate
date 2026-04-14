import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Seeder, DataFactory } from "nestjs-seeder";
import * as bcrypt from "bcrypt";
import { User } from "../../modules/users/entities/user.entity";

@Injectable()
export class UsersSeeder implements Seeder {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async seed(): Promise<any> {
    const adminEmail = "admin@healthcare.com";
    
    // Check if admin already exists
    const existingAdmin = await this.userRepository.findOne({
      where: { email: adminEmail },
    });

    if (existingAdmin) {
      console.log("Admin user already exists. Skipping...");
      return;
    }

    const hashedPassword = await bcrypt.hash("Admin@Health123", 10);

    const admin = this.userRepository.create({
      email: adminEmail,
      firstName: "System",
      lastName: "Administrator",
      password: hashedPassword,
      isActive: true,
    });

    return this.userRepository.save(admin);
  }

  async drop(): Promise<any> {
    // We usually don't want to drop users in a production-like healthcare system
    // but this method is required by the Seeder interface.
    // return this.userRepository.delete({});
  }
}
