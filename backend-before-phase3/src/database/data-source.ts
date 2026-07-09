import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

// Used only by the `typeorm` CLI (see package.json scripts) to generate
// and run migrations. The running NestJS app configures its own
// connection in app.module.ts — the two are kept separate on purpose so
// migrations always run explicitly, never via `synchronize`.
export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
});
