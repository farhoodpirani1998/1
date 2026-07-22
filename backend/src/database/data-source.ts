import { DataSource } from 'typeorm';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

// Used only by the `typeorm` CLI (see package.json scripts) to generate
// and run migrations. The running NestJS app configures its own
// connection in app.module.ts — the two are kept separate on purpose so
// migrations always run explicitly, never via `synchronize`.
//
// Sprint 2.5 — production readiness: this file is compiled by `nest
// build` into dist/database/data-source.js same as everything else under
// src/, so at require-time it can tell which form of itself is actually
// running and glob against the matching tree:
//   - .ts (this file, via ts-node-commonjs) => src/**/*.ts, for
//     `npm run migration:run` in local dev / anywhere the full src/ tree
//     and devDependencies are present.
//   - .js (the compiled file, via the plain `typeorm` CLI -- no ts-node
//     needed) => dist/**/*.js, for `npm run migration:run:prod`, the only
//     form that works inside the production image (see Dockerfile),
//     which ships neither ts-node/typescript nor src/.
const isCompiled = path.extname(__filename) === '.js';
const root = isCompiled ? 'dist' : 'src';
const ext = isCompiled ? 'js' : 'ts';

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [`${root}/**/*.entity.${ext}`],
  migrations: [`${root}/database/migrations/*.${ext}`],
});
