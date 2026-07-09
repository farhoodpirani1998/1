import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { User } from '../modules/users/entities/user.entity';

dotenv.config();

const BCRYPT_ROUNDS = 12;

/**
 * Run once after migrations, before the app is used for the first time:
 *   npm run seed
 *
 * Creates a single super_admin from SEED_ADMIN_PHONE / SEED_ADMIN_PASSWORD
 * env vars (falls back to defaults for local dev — change them in .env).
 * Safe to run multiple times: does nothing if a super_admin already exists.
 */
async function seed() {
  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [User],
  });
  await dataSource.initialize();

  const userRepo = dataSource.getRepository(User);

  const existing = await userRepo.findOne({ where: { role: 'super_admin' } });
  if (existing) {
    console.log('A super_admin already exists — nothing to do.');
    await dataSource.destroy();
    return;
  }

  const phone = process.env.SEED_ADMIN_PHONE ?? '09120000000';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const admin = userRepo.create({
    schoolId: null,
    fullName: 'مدیر کل سیستم',
    phone,
    passwordHash,
    role: 'super_admin',
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
