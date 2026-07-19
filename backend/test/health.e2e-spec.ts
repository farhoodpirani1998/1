import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp } from './setup/test-app';

/**
 * Health — previously had zero e2e coverage even though the controller
 * itself is unusual: it's the only controller in the app with no
 * @UseGuards(...) at all, by deliberate design (load balancers, k8s
 * probes, and uptime monitors hit it unauthenticated). That's exactly the
 * kind of "deliberately different from everything else" behavior that's
 * easy to break by accident (e.g. someone copy-pastes @UseGuards(JwtAuthGuard)
 * onto it later) without a test ever catching it.
 *
 * Proves that:
 * 1. GET /health/live, /health/ready, and /health all respond 200 with no
 *    Authorization header at all -- confirming the "no guards" design
 *    actually holds at the HTTP layer, not just in the source comment.
 * 2. A garbage/expired Authorization header doesn't get rejected either --
 *    these routes truly ignore auth rather than merely tolerating its
 *    absence.
 * 3. /health/live checks nothing external (empty info/details) -- a
 *    liveness probe that doesn't depend on Postgres/Redis being up.
 * 4. /health/ready and /health both report the database and redis
 *    indicators as "up" against the real test Postgres/Redis.
 */
describe('Health (e2e)', () => {
  let app: INestApplication;
  let server: any;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  describe('GET /health/live', () => {
    it('responds 200 with no Authorization header', async () => {
      const res = await request(server).get('/api/v1/health/live');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });

    it('checks nothing external -- no database/redis indicators reported', async () => {
      const res = await request(server).get('/api/v1/health/live');
      expect(res.status).toBe(200);
      expect(res.body.info).toEqual({});
      expect(res.body.details).toEqual({});
    });

    it('ignores a garbage Authorization header rather than rejecting it', async () => {
      const res = await request(server)
        .get('/api/v1/health/live')
        .set('Authorization', 'Bearer not-a-real-token');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /health/ready', () => {
    it('responds 200 with no Authorization header', async () => {
      const res = await request(server).get('/api/v1/health/ready');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });

    it('reports both database and redis as up', async () => {
      const res = await request(server).get('/api/v1/health/ready');
      expect(res.status).toBe(200);
      expect(res.body.info.database).toEqual({ status: 'up' });
      expect(res.body.info.redis).toEqual({ status: 'up' });
      expect(res.body.details.database).toEqual({ status: 'up' });
      expect(res.body.details.redis).toEqual({ status: 'up' });
    });
  });

  describe('GET /health', () => {
    it('responds 200 with no Authorization header and reports the same checks as /ready', async () => {
      const res = await request(server).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.info.database).toEqual({ status: 'up' });
      expect(res.body.info.redis).toEqual({ status: 'up' });
    });

    it('ignores a garbage Authorization header rather than rejecting it', async () => {
      const res = await request(server)
        .get('/api/v1/health')
        .set('Authorization', 'Bearer not-a-real-token');
      expect(res.status).toBe(200);
    });
  });
});
