import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp, truncateAll, getDataSource } from './setup/test-app';
import { createSchool, createUser, authHeader, Role } from './setup/factories';
import { AuditLog, AuditAction } from '../src/common/audit/audit-log.entity';

/**
 * Seeds an audit_logs row directly (bypassing AuditService.record()/the
 * domain-event flow), same convention as createLedgerEntry/createAttendance
 * etc. in setup/factories.ts — this suite is testing the read API, not
 * AuditEventsListener, so fixtures don't need to go through a real
 * domain-event emission.
 */
async function seedAuditLog(
  app: INestApplication,
  opts: {
    schoolId: string | null;
    userId?: string | null;
    action?: AuditAction;
    entityType?: string;
    entityId: string;
    createdAt?: Date;
  },
): Promise<AuditLog> {
  const ds = getDataSource(app);
  const repo = ds.getRepository(AuditLog);
  const row = repo.create({
    schoolId: opts.schoolId,
    userId: opts.userId ?? null,
    action: opts.action ?? AuditAction.LOGIN_SUCCEEDED,
    entityType: opts.entityType ?? 'user',
    entityId: opts.entityId,
    oldValue: null,
    newValue: null,
  });
  const saved = await repo.save(row);
  if (opts.createdAt) {
    // createdAt has a DB-level default (now()); overriding it after insert
    // is the same "control ordering deterministically" convention
    // createLedgerEntry/createNotification already use elsewhere.
    await repo.update(saved.id, { createdAt: opts.createdAt });
    saved.createdAt = opts.createdAt;
  }
  return saved;
}

describe('Audit log read API (e2e)', () => {
  let app: INestApplication;
  let server: any;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  beforeEach(async () => {
    await truncateAll(app);
  });

  it('school_admin sees only their own school logs', async () => {
    const schoolA = await createSchool(app);
    const schoolB = await createSchool(app);
    const adminA = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: schoolA.id });

    const rowA = await seedAuditLog(app, { schoolId: schoolA.id, entityId: adminA.id });
    await seedAuditLog(app, { schoolId: schoolB.id, entityId: adminA.id });

    const res = await request(server)
      .get('/api/v1/audit-logs')
      .set('Authorization', authHeader(app, adminA));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(rowA.id);
    expect(res.body.data[0].schoolId).toBe(schoolA.id);
  });

  it('school_admin cannot access another school\'s logs, even by attempting to pass schoolId explicitly', async () => {
    const schoolA = await createSchool(app);
    const schoolB = await createSchool(app);
    const adminA = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: schoolA.id });

    await seedAuditLog(app, { schoolId: schoolB.id, entityId: adminA.id });

    // QueryAuditLogsDto never declares a schoolId field, and the app's
    // global ValidationPipe runs with forbidNonWhitelisted: true, so an
    // attempt to smuggle a schoolId in is rejected outright rather than
    // silently accepted or silently ignored.
    const res = await request(server)
      .get('/api/v1/audit-logs')
      .query({ schoolId: schoolB.id })
      .set('Authorization', authHeader(app, adminA));

    expect(res.status).toBe(400);

    // And without attempting to pass anything, school_admin still never
    // sees schoolB's row.
    const plainRes = await request(server)
      .get('/api/v1/audit-logs')
      .set('Authorization', authHeader(app, adminA));
    expect(plainRes.status).toBe(200);
    expect(plainRes.body.data).toHaveLength(0);
  });

  it('super_admin can see audit logs across every school', async () => {
    const schoolA = await createSchool(app);
    const schoolB = await createSchool(app);
    const superAdmin = await createUser(app, { role: Role.SUPER_ADMIN, schoolId: null });

    await seedAuditLog(app, { schoolId: schoolA.id, entityId: superAdmin.id });
    await seedAuditLog(app, { schoolId: schoolB.id, entityId: superAdmin.id });

    const res = await request(server)
      .get('/api/v1/audit-logs')
      .set('Authorization', authHeader(app, superAdmin));

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data).toHaveLength(2);
  });

  it('rejects a role with no audit access (403)', async () => {
    const school = await createSchool(app);
    const staff = await createUser(app, { role: Role.STAFF, schoolId: school.id });

    const res = await request(server)
      .get('/api/v1/audit-logs')
      .set('Authorization', authHeader(app, staff));

    expect(res.status).toBe(403);
  });

  it('paginates results (page/limit honored, newest first)', async () => {
    const school = await createSchool(app);
    const admin = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: school.id });

    // Five rows, each one second apart, oldest first when created but the
    // API must return them newest-first.
    const base = new Date('2026-01-01T00:00:00.000Z');
    const rows: AuditLog[] = [];
    for (let i = 0; i < 5; i += 1) {
      rows.push(
        await seedAuditLog(app, {
          schoolId: school.id,
          entityId: admin.id,
          createdAt: new Date(base.getTime() + i * 1000),
        }),
      );
    }

    const page1 = await request(server)
      .get('/api/v1/audit-logs')
      .query({ page: 1, limit: 2 })
      .set('Authorization', authHeader(app, admin));

    expect(page1.status).toBe(200);
    expect(page1.body.total).toBe(5);
    expect(page1.body.page).toBe(1);
    expect(page1.body.limit).toBe(2);
    expect(page1.body.data).toHaveLength(2);
    // Newest first: rows[4] (last seeded, latest createdAt) comes before rows[3].
    expect(page1.body.data[0].id).toBe(rows[4].id);
    expect(page1.body.data[1].id).toBe(rows[3].id);

    const page2 = await request(server)
      .get('/api/v1/audit-logs')
      .query({ page: 2, limit: 2 })
      .set('Authorization', authHeader(app, admin));

    expect(page2.status).toBe(200);
    expect(page2.body.data).toHaveLength(2);
    expect(page2.body.data[0].id).toBe(rows[2].id);
    expect(page2.body.data[1].id).toBe(rows[1].id);
  });

  it('rejects an invalid limit (e.g. 0) with 400', async () => {
    const school = await createSchool(app);
    const admin = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: school.id });

    const res = await request(server)
      .get('/api/v1/audit-logs')
      .query({ limit: 0 })
      .set('Authorization', authHeader(app, admin));

    expect(res.status).toBe(400);
  });
});
