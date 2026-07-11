import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp, truncateAll } from './setup/test-app';
import {
  createSchool,
  createUser,
  createAcademicYear,
  createGrade,
  createStudent,
  linkParentStudent,
  authHeader,
  Role,
} from './setup/factories';

describe('Parent portal (e2e)', () => {
  let app: INestApplication;
  let server: any;

  let schoolA: Awaited<ReturnType<typeof createSchool>>;
  let schoolB: Awaited<ReturnType<typeof createSchool>>;
  let schoolAdminA: Awaited<ReturnType<typeof createUser>>;
  let parentA: Awaited<ReturnType<typeof createUser>>;
  let otherParentA: Awaited<ReturnType<typeof createUser>>;
  let parentB: Awaited<ReturnType<typeof createUser>>;
  let studentA1: Awaited<ReturnType<typeof createStudent>>;
  let studentA2: Awaited<ReturnType<typeof createStudent>>;
  let studentB: Awaited<ReturnType<typeof createStudent>>;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  beforeEach(async () => {
    await truncateAll(app);

    schoolA = await createSchool(app, { name: 'School A' });
    schoolB = await createSchool(app, { name: 'School B' });

    schoolAdminA = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: schoolA.id });
    parentA = await createUser(app, { role: Role.PARENT, schoolId: schoolA.id });
    otherParentA = await createUser(app, { role: Role.PARENT, schoolId: schoolA.id });
    parentB = await createUser(app, { role: Role.PARENT, schoolId: schoolB.id });

    const yearA = await createAcademicYear(app, schoolA.id);
    const gradeA = await createGrade(app, schoolA.id, { title: 'Grade 7' });
    studentA1 = await createStudent(app, schoolA.id, {
      academicYearId: yearA.id,
      gradeId: gradeA.id,
      fullName: 'Student One',
    });
    studentA2 = await createStudent(app, schoolA.id, {
      academicYearId: yearA.id,
      gradeId: gradeA.id,
      fullName: 'Student Two',
    });

    const yearB = await createAcademicYear(app, schoolB.id);
    const gradeB = await createGrade(app, schoolB.id);
    studentB = await createStudent(app, schoolB.id, {
      academicYearId: yearB.id,
      gradeId: gradeB.id,
      fullName: 'Student In School B',
    });

    // parentA is linked to both of their children; otherParentA and
    // parentB start with no links.
    await linkParentStudent(app, parentA.id, studentA1.id);
    await linkParentStudent(app, parentA.id, studentA2.id);
  });

  describe('GET /parent/students', () => {
    it("returns exactly the parent's own linked children, with school/grade/year", async () => {
      const res = await request(server)
        .get('/api/v1/parent/students')
        .set('Authorization', authHeader(app, parentA));
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      const ids = res.body.map((s: any) => s.id).sort();
      expect(ids).toEqual([studentA1.id, studentA2.id].sort());

      const first = res.body[0];
      expect(first.school).toEqual({ id: schoolA.id, name: 'School A' });
      expect(first.grade.title).toBe('Grade 7');
      expect(first.academicYear).toHaveProperty('id');
    });

    it('returns an empty array for a parent with no linked children', async () => {
      const res = await request(server)
        .get('/api/v1/parent/students')
        .set('Authorization', authHeader(app, otherParentA));
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('never includes a child belonging to a different parent', async () => {
      const res = await request(server)
        .get('/api/v1/parent/students')
        .set('Authorization', authHeader(app, otherParentA));
      expect(res.status).toBe(200);
      expect(res.body.find((s: any) => s.id === studentA1.id)).toBeUndefined();
    });

    it('is rejected for a non-parent role', async () => {
      const res = await request(server)
        .get('/api/v1/parent/students')
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(res.status).toBe(403);
    });

    it('rejects an unauthenticated request', async () => {
      const res = await request(server).get('/api/v1/parent/students');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /parent/students/:id', () => {
    it('returns the child when linked to the requesting parent', async () => {
      const res = await request(server)
        .get(`/api/v1/parent/students/${studentA1.id}`)
        .set('Authorization', authHeader(app, parentA));
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(studentA1.id);
      expect(res.body.fullName).toBe('Student One');
    });

    it('returns 404 for a real student the parent is not linked to', async () => {
      const res = await request(server)
        .get(`/api/v1/parent/students/${studentA1.id}`)
        .set('Authorization', authHeader(app, otherParentA));
      expect(res.status).toBe(404);
    });

    it("returns 404 (not 403) for another school's student, even by real UUID", async () => {
      const res = await request(server)
        .get(`/api/v1/parent/students/${studentB.id}`)
        .set('Authorization', authHeader(app, parentA));
      expect(res.status).toBe(404);
    });

    it('never leaks cross-school data even if a parent in School B is somehow linked to a School A student', async () => {
      // Simulates a corrupted/legacy row rather than something reachable
      // through the API (link() itself blocks cross-school linking) —
      // proves findMyStudent's defense-in-depth schoolId re-check works
      // even if that invariant were ever violated upstream.
      await linkParentStudent(app, parentB.id, studentA1.id);

      const res = await request(server)
        .get(`/api/v1/parent/students/${studentA1.id}`)
        .set('Authorization', authHeader(app, parentB));
      expect(res.status).toBe(404);
    });
  });

  describe('POST /parent/link (school_admin manages relationships)', () => {
    it('links a parent to a student within the same school', async () => {
      const res = await request(server)
        .post('/api/v1/parent/link')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ parentId: otherParentA.id, studentId: studentA1.id });
      expect(res.status).toBe(201);

      const listRes = await request(server)
        .get('/api/v1/parent/students')
        .set('Authorization', authHeader(app, otherParentA));
      expect(listRes.body.map((s: any) => s.id)).toContain(studentA1.id);
    });

    it('is idempotent: linking the same pair twice does not duplicate', async () => {
      await request(server)
        .post('/api/v1/parent/link')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ parentId: otherParentA.id, studentId: studentA1.id });
      await request(server)
        .post('/api/v1/parent/link')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ parentId: otherParentA.id, studentId: studentA1.id });

      const listRes = await request(server)
        .get('/api/v1/parent/students')
        .set('Authorization', authHeader(app, otherParentA));
      expect(listRes.body.filter((s: any) => s.id === studentA1.id)).toHaveLength(1);
    });

    it("rejects linking School B's student from School A's admin", async () => {
      const res = await request(server)
        .post('/api/v1/parent/link')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ parentId: parentA.id, studentId: studentB.id });
      expect(res.status).toBe(403);
    });

    it("rejects linking a parent that belongs to a different school", async () => {
      const res = await request(server)
        .post('/api/v1/parent/link')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ parentId: parentB.id, studentId: studentA1.id });
      expect(res.status).toBe(403);
    });

    it('rejects linking a non-parent user', async () => {
      const res = await request(server)
        .post('/api/v1/parent/link')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ parentId: schoolAdminA.id, studentId: studentA1.id });
      expect(res.status).toBe(400);
    });

    it('is rejected for a non-school_admin role', async () => {
      const res = await request(server)
        .post('/api/v1/parent/link')
        .set('Authorization', authHeader(app, parentA))
        .send({ parentId: otherParentA.id, studentId: studentA1.id });
      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /parent/link/:id', () => {
    it('removes an existing link', async () => {
      const linkRes = await request(server)
        .post('/api/v1/parent/link')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ parentId: otherParentA.id, studentId: studentA1.id });

      const delRes = await request(server)
        .delete(`/api/v1/parent/link/${linkRes.body.id}`)
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(delRes.status).toBe(204);

      const listRes = await request(server)
        .get('/api/v1/parent/students')
        .set('Authorization', authHeader(app, otherParentA));
      expect(listRes.body.map((s: any) => s.id)).not.toContain(studentA1.id);
    });
  });

  describe('Parent role excluded from staff-facing endpoints', () => {
    it('cannot list the full student roster via GET /students', async () => {
      const res = await request(server)
        .get('/api/v1/students')
        .set('Authorization', authHeader(app, parentA));
      expect(res.status).toBe(403);
    });

    it('cannot read a single student via GET /students/:id', async () => {
      const res = await request(server)
        .get(`/api/v1/students/${studentA1.id}`)
        .set('Authorization', authHeader(app, parentA));
      expect(res.status).toBe(403);
    });

    it('cannot list academic years', async () => {
      const res = await request(server)
        .get('/api/v1/academic-years')
        .set('Authorization', authHeader(app, parentA));
      expect(res.status).toBe(403);
    });

    it('cannot list grades', async () => {
      const res = await request(server)
        .get('/api/v1/grades')
        .set('Authorization', authHeader(app, parentA));
      expect(res.status).toBe(403);
    });

    it('cannot list tuition plans', async () => {
      const res = await request(server)
        .get(`/api/v1/tuition-plans?studentId=${studentA1.id}`)
        .set('Authorization', authHeader(app, parentA));
      expect(res.status).toBe(403);
    });
  });
});
