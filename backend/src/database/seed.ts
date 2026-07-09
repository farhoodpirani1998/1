import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { User } from '../modules/users/entities/user.entity';
import { Role } from '../common/authorization/roles.enum';

dotenv.config();

const BCRYPT_ROUNDS = 12;

/**
 * Run once after migrations, before the app is used for the first time:
 *   npm run seed
 *
 * Creates a single super_admin from the required SEED_ADMIN_PHONE /
 * SEED_ADMIN_PASSWORD env vars — there is no default fallback for either
 * (a hardcoded fallback password would mean every fresh deployment that
 * forgets to set it ships with the same publicly-known credential).
 * Fails loudly and refuses to run if either is missing.
 * Safe to run multiple times: does nothing if a super_admin already exists.
 */
async function seed() {
  const phone = process.env.SEED_ADMIN_PHONE;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!phone || !password) {
    console.error(
      'Seed failed: SEED_ADMIN_PHONE and SEED_ADMIN_PASSWORD must both be set in the environment.',
    );
    console.error(
      'There is no default fallback for these — set them in .env before running `npm run seed`.',
    );
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('Seed failed: SEED_ADMIN_PASSWORD must be at least 8 characters.');
    process.exit(1);
  }

  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [User],
  });
  await dataSource.initialize();

  const userRepo = dataSource.getRepository(User);

  const existing = await userRepo.findOne({ where: { role: Role.SUPER_ADMIN } });
  if (existing) {
    console.log('A super_admin already exists — nothing to do.');
    await dataSource.destroy();
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const admin = userRepo.create({
    schoolId: null,
    fullName: 'مدیر کل سیستم',
    phone,
    passwordHash,
    role: Role.SUPER_ADMIN,
    isActive: true,
  });
  await userRepo.save(admin);

  console.log('✅ super_admin created:');
  console.log(`   phone: ${phone}`);
  console.log(`   password: ${password}`);
  console.log('   Log in and change this password immediately.');

  await dataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
