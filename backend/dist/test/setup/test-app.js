"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureMigrations = ensureMigrations;
exports.createTestApp = createTestApp;
exports.getDataSource = getDataSource;
exports.truncateAll = truncateAll;
exports.closeTestApp = closeTestApp;
exports.closeMigrationDataSource = closeMigrationDataSource;
const testing_1 = require("@nestjs/testing");
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const typeorm_1 = require("typeorm");
const app_module_1 = require("../../src/app.module");
const http_exception_filter_1 = require("../../src/common/filters/http-exception.filter");
const migrationDataSource = require('../../src/database/data-source').default;
let migrationsRun = false;
async function ensureMigrations() {
    if (migrationsRun)
        return;
    if (!migrationDataSource.isInitialized) {
        await migrationDataSource.initialize();
    }
    await migrationDataSource.runMigrations();
    migrationsRun = true;
}
const alwaysAllow = { canActivate: () => true };
async function createTestApp() {
    await ensureMigrations();
    const moduleRef = await testing_1.Test.createTestingModule({
        imports: [app_module_1.AppModule],
    })
        .overrideGuard(throttler_1.ThrottlerGuard)
        .useValue(alwaysAllow)
        .compile();
    const app = moduleRef.createNestApplication();
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    app.useGlobalFilters(new http_exception_filter_1.AllExceptionsFilter());
    app.setGlobalPrefix('api/v1');
    await app.init();
    return app;
}
function getDataSource(app) {
    return app.get(typeorm_1.DataSource);
}
async function truncateAll(app) {
    const ds = getDataSource(app);
    const tables = [
        'audit_logs',
        'school_settings',
        'homework',
        'timetable_entries',
        'announcements',
        'attendance',
        'teacher_assignments',
        'student_assessments',
        'subjects',
        'notifications',
        'financial_ledger',
        'receipt_counters',
        'payments',
        'installments',
        'tuition_plans',
        'parent_students',
        'students',
        'guardians',
        'grades',
        'academic_years',
        'users',
        'schools',
    ];
    await ds.query(`TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
}
async function closeTestApp(app) {
    await app.close();
}
async function closeMigrationDataSource() {
    if (migrationDataSource.isInitialized) {
        await migrationDataSource.destroy();
    }
}
//# sourceMappingURL=test-app.js.map