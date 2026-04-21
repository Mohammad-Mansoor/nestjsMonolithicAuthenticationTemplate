import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1776764093207 implements MigrationInterface {
    name = 'InitialSchema1776764093207'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // --- 1. Enums ---
        // Create custom ENUM type for file reference types (Profile pics, reports, etc.)
        await queryRunner.query(`CREATE TYPE "public"."files_referencetype_enum" AS ENUM('user_profile', 'ambulance_doc', 'prescription', 'medical_report', 'other')`);

        // --- 2. Tables & Core Schema ---
        
        // Files Table: Stores metadata for uploaded documents and images
        await queryRunner.query(`CREATE TABLE "files" ("id" SERIAL NOT NULL, "originalName" character varying NOT NULL, "fileName" character varying NOT NULL, "path" character varying NOT NULL, "mimetype" character varying NOT NULL, "size" integer NOT NULL, "referenceId" character varying NOT NULL, "referenceType" "public"."files_referencetype_enum" NOT NULL DEFAULT 'other', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "uploadedById" uuid, CONSTRAINT "PK_6c16b9093a142e0e7613b04a3d9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e4f2a975a204d1bc4cbb7b1166" ON "files" ("referenceId") `);
        await queryRunner.query(`CREATE INDEX "IDX_003676d9439fc3a0059ab993f8" ON "files" ("referenceType") `);

        // Sessions Table: Manages user login sessions and refresh tokens
        await queryRunner.query(`CREATE TABLE "sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "refreshToken" character varying NOT NULL, "ipAddress" character varying NOT NULL, "userAgent" character varying, "deviceId" character varying, "deviceName" character varying, "fingerprint" character varying, "deviceType" character varying, "isValid" boolean NOT NULL DEFAULT true, "os" character varying, "browser" character varying, "expiresAt" TIMESTAMP NOT NULL, "lastActiveAt" TIMESTAMP, "logoutAt" TIMESTAMP, "revokedAt" TIMESTAMP, "revokeReason" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_3238ef96f18b355b671619111bc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_57de40bc620f456c7311aa3a1e" ON "sessions" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b443618a8149644123d48eceed" ON "sessions" ("refreshToken") `);
        await queryRunner.query(`CREATE INDEX "IDX_fd11aa87698d5a784713b9de97" ON "sessions" ("deviceId") `);
        await queryRunner.query(`CREATE INDEX "IDX_688c6607f9924557c583a31083" ON "sessions" ("isValid") `);
        await queryRunner.query(`CREATE INDEX "IDX_50762206f116cd47d1c3fec396" ON "sessions" ("expiresAt") `);

        // Users Table: Core user profile data and contact info
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "firstName" character varying NOT NULL, "lastName" character varying NOT NULL, "whatsappNumber" character varying, "telegramUsername" character varying, "telegramId" character varying, "password" character varying NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "lastLoginAt" TIMESTAMP, "lastLoginIp" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "lastLogin" TIMESTAMP, "profileImageId" integer, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "REL_e6f8c136a8e286370ac3b5d73b" UNIQUE ("profileImageId"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_5372672fbfd1677205e0ce3ece" ON "users" ("firstName") `);
        await queryRunner.query(`CREATE INDEX "IDX_af99afb7cf88ce20aff6977e68" ON "users" ("lastName") `);
        await queryRunner.query(`CREATE INDEX "IDX_790af40fdb8b562f9cf5dfccb1" ON "users" ("whatsappNumber") `);
        await queryRunner.query(`CREATE INDEX "IDX_b6690669b51232b543e4a3b010" ON "users" ("telegramUsername") `);
        await queryRunner.query(`CREATE INDEX "IDX_df18d17f84763558ac84192c75" ON "users" ("telegramId") `);
        await queryRunner.query(`CREATE INDEX "IDX_409a0298fdd86a6495e23c25c6" ON "users" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_204e9b624861ff4a5b26819210" ON "users" ("createdAt") `);

        // Notification Options Table: User preferences for notification channels
        await queryRunner.query(`CREATE TABLE "users_notification_options" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "email" boolean NOT NULL DEFAULT true, "whatsapp" boolean NOT NULL DEFAULT true, "telegram" boolean NOT NULL DEFAULT true, "inapp" boolean NOT NULL DEFAULT true, "socket" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "REL_0e3131a31129b64678940fd7b9" UNIQUE ("userId"), CONSTRAINT "PK_abbb74f75cd711cd628f5776dfc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0e3131a31129b64678940fd7b9" ON "users_notification_options" ("userId") `);

        // User Devices Table: Tracking specific hardware devices for security and push notifications
        await queryRunner.query(`CREATE TABLE "user_devices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "deviceId" character varying NOT NULL, "deviceName" character varying, "deviceType" character varying, "fingerprint" character varying NOT NULL, "userAgent" character varying, "browser" character varying, "os" character varying, "lastIp" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "lastLoginAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c9e7e648903a9e537347aba4371" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e12ac4f8016243ac71fd2e415a" ON "user_devices" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e81c41e04269a2d2152f0d60b5" ON "user_devices" ("deviceId") `);
        await queryRunner.query(`CREATE INDEX "IDX_87704bb72ef70822c6a6e6a566" ON "user_devices" ("fingerprint") `);
        await queryRunner.query(`CREATE INDEX "IDX_d0b5b26aecd1a19834d40836f7" ON "user_devices" ("lastLoginAt") `);

        // --- 3. Relationships & Foreign Keys ---
        // We add constraints AFTER tables are created to ensure references are valid.
        await queryRunner.query(`ALTER TABLE "files" ADD CONSTRAINT "FK_a525d85f0ac59aa9a971825e1af" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sessions" ADD CONSTRAINT "FK_57de40bc620f456c7311aa3a1e6" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_e6f8c136a8e286370ac3b5d73b6" FOREIGN KEY ("profileImageId") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "users_notification_options" ADD CONSTRAINT "FK_0e3131a31129b64678940fd7b9f" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_devices" ADD CONSTRAINT "FK_e12ac4f8016243ac71fd2e415af" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop constraints first to avoid "referenced by" errors
        await queryRunner.query(`ALTER TABLE "user_devices" DROP CONSTRAINT "FK_e12ac4f8016243ac71fd2e415af"`);
        await queryRunner.query(`ALTER TABLE "users_notification_options" DROP CONSTRAINT "FK_0e3131a31129b64678940fd7b9f"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_e6f8c136a8e286370ac3b5d73b6"`);
        await queryRunner.query(`ALTER TABLE "sessions" DROP CONSTRAINT "FK_57de40bc620f456c7311aa3a1e6"`);
        await queryRunner.query(`ALTER TABLE "files" DROP CONSTRAINT "FK_a525d85f0ac59aa9a971825e1af"`);
        
        // Drop indexes and tables in reverse order of creation
        await queryRunner.query(`DROP INDEX "public"."IDX_d0b5b26aecd1a19834d40836f7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_87704bb72ef70822c6a6e6a566"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e81c41e04269a2d2152f0d60b5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e12ac4f8016243ac71fd2e415a"`);
        await queryRunner.query(`DROP TABLE "user_devices"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0e3131a31129b64678940fd7b9"`);
        await queryRunner.query(`DROP TABLE "users_notification_options"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_204e9b624861ff4a5b26819210"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_409a0298fdd86a6495e23c25c6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_df18d17f84763558ac84192c75"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b6690669b51232b543e4a3b010"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_790af40fdb8b562f9cf5dfccb1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_af99afb7cf88ce20aff6977e68"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5372672fbfd1677205e0ce3ece"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_50762206f116cd47d1c3fec396"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_688c6607f9924557c583a31083"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fd11aa87698d5a784713b9de97"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b443618a8149644123d48eceed"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_57de40bc620f456c7311aa3a1e"`);
        await queryRunner.query(`DROP TABLE "sessions"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_003676d9439fc3a0059ab993f8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e4f2a975a204d1bc4cbb7b1166"`);
        await queryRunner.query(`DROP TABLE "files"`);
        await queryRunner.query(`DROP TYPE "public"."files_referencetype_enum"`);
    }

}
