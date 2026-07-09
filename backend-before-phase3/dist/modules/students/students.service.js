"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudentsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const student_entity_1 = require("./entities/student.entity");
const guardian_entity_1 = require("./entities/guardian.entity");
const guardians_service_1 = require("./guardians.service");
const notifications_service_1 = require("../notifications/notifications.service");
let StudentsService = class StudentsService {
    constructor(studentRepo, guardiansService, dataSource, notificationsService) {
        this.studentRepo = studentRepo;
        this.guardiansService = guardiansService;
        this.dataSource = dataSource;
        this.notificationsService = notificationsService;
    }
    async create(dto, schoolId) {
        if (!dto.guardianId && !dto.newGuardian) {
            throw new common_1.BadRequestException('باید یا guardianId یا اطلاعات یک والد جدید ارسال شود');
        }
        if (dto.guardianId && dto.newGuardian) {
            throw new common_1.BadRequestException('فقط یکی از guardianId یا newGuardian باید ارسال شود، نه هر دو');
        }
        const student = await this.dataSource.transaction(async (manager) => {
            let guardianId = dto.guardianId;
            if (dto.newGuardian) {
                const guardian = await this.guardiansService.findOrCreate(dto.newGuardian, schoolId, manager);
                guardianId = guardian.id;
            }
            const entity = manager.getRepository(student_entity_1.Student).create({
                schoolId,
                guardianId,
                classId: dto.classId,
                fullName: dto.fullName,
                nationalId: dto.nationalId ?? null,
                birthDate: dto.birthDate ?? null,
                address: dto.address ?? null,
                enrollmentDate: dto.enrollmentDate ?? null,
            });
            return manager.getRepository(student_entity_1.Student).save(entity);
        });
        await this.notificationsService.queueWelcomeMessage(student.id);
        return student;
    }
    async findWithFilters(query, schoolId) {
        const qb = this.studentRepo
            .createQueryBuilder('student')
            .leftJoinAndSelect('student.guardian', 'guardian')
            .leftJoinAndSelect('student.class', 'class')
            .leftJoinAndSelect('class.grade', 'grade')
            .where('student.schoolId = :schoolId', { schoolId });
        if (query.status) {
            qb.andWhere('student.status = :status', { status: query.status });
        }
        if (query.classId) {
            qb.andWhere('student.classId = :classId', { classId: query.classId });
        }
        if (query.search) {
            qb.andWhere('student.fullName ILIKE :search', { search: `%${query.search}%` });
        }
        return qb.orderBy('student.fullName', 'ASC').getMany();
    }
    async findOne(id, schoolId) {
        const student = await this.studentRepo.findOne({
            where: { id, schoolId },
            relations: ['guardian', 'class', 'class.grade', 'class.academicYear'],
        });
        if (!student) {
            throw new common_1.NotFoundException('دانش‌آموز یافت نشد');
        }
        return student;
    }
    async update(id, dto, schoolId) {
        const student = await this.findOne(id, schoolId);
        Object.assign(student, dto);
        await this.studentRepo.save(student);
        return this.findOne(id, schoolId);
    }
    async softDelete(id, schoolId) {
        await this.findOne(id, schoolId);
        await this.studentRepo.softDelete(id);
    }
    async findArchived(schoolId) {
        return this.studentRepo.find({
            where: { schoolId, deletedAt: (0, typeorm_2.Not)((0, typeorm_2.IsNull)()) },
            withDeleted: true,
            relations: ['class', 'class.grade'],
            order: { deletedAt: 'DESC' },
        });
    }
    async searchAll(search) {
        return this.studentRepo
            .createQueryBuilder('student')
            .leftJoinAndSelect('student.school', 'school')
            .leftJoinAndSelect('student.guardian', 'guardian')
            .where('student.fullName ILIKE :search', { search: `%${search}%` })
            .orderBy('student.fullName', 'ASC')
            .limit(20)
            .getMany();
    }
    async restore(id, schoolId) {
        const student = await this.studentRepo.findOne({
            where: { id, schoolId },
            withDeleted: true,
        });
        if (!student) {
            throw new common_1.NotFoundException('دانش‌آموز یافت نشد');
        }
        await this.studentRepo.restore(id);
        return this.findOne(id, schoolId);
    }
    async transfer(id, targetSchoolId) {
        return this.dataSource.transaction(async (manager) => {
            const studentRepo = manager.getRepository(student_entity_1.Student);
            const guardianRepo = manager.getRepository(guardian_entity_1.Guardian);
            const student = await studentRepo.findOne({ where: { id } });
            if (!student) {
                throw new common_1.NotFoundException('دانش‌آموز یافت نشد');
            }
            if (student.schoolId === targetSchoolId) {
                throw new common_1.BadRequestException('مدرسه‌ی مقصد نمی‌تواند همان مدرسه‌ی فعلی باشد');
            }
            const currentSchoolId = student.schoolId;
            let newGuardianId = student.guardianId;
            if (student.guardianId) {
                const siblingsRemaining = await studentRepo.count({
                    where: { guardianId: student.guardianId, schoolId: currentSchoolId, id: (0, typeorm_2.Not)(id) },
                });
                if (siblingsRemaining === 0) {
                    await guardianRepo.update(student.guardianId, { schoolId: targetSchoolId });
                }
                else {
                    const oldGuardian = await guardianRepo.findOne({ where: { id: student.guardianId } });
                    if (oldGuardian) {
                        const duplicated = guardianRepo.create({
                            schoolId: targetSchoolId,
                            fullName: oldGuardian.fullName,
                            phone: oldGuardian.phone,
                            nationalId: oldGuardian.nationalId,
                        });
                        const saved = await guardianRepo.save(duplicated);
                        newGuardianId = saved.id;
                    }
                }
            }
            student.schoolId = targetSchoolId;
            student.guardianId = newGuardianId;
            student.classId = null;
            student.transferredFromSchoolId = currentSchoolId;
            return studentRepo.save(student);
        });
    }
};
exports.StudentsService = StudentsService;
exports.StudentsService = StudentsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(student_entity_1.Student)),
    __param(2, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeof (_a = typeof typeorm_2.Repository !== "undefined" && typeorm_2.Repository) === "function" ? _a : Object, guardians_service_1.GuardiansService, typeof (_b = typeof typeorm_2.DataSource !== "undefined" && typeorm_2.DataSource) === "function" ? _b : Object, notifications_service_1.NotificationsService])
], StudentsService);
//# sourceMappingURL=students.service.js.map