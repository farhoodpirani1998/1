process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ??
        'postgres://postgres:postgres@localhost:5433/tuitionschool_test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-only-secret-do-not-use-in-prod';
process.env.REDIS_HOST = process.env.REDIS_HOST ?? 'localhost';
process.env.REDIS_PORT = process.env.REDIS_PORT ?? '6380';
process.env.CORS_ORIGINS = process.env.CORS_ORIGINS ?? 'http://localhost:3000';
//# sourceMappingURL=env.js.map