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
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudentsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const student_entity_1 = require("./entities/student.entity");
const guardian_entity_1 = require("./entities/guardian.entity");
const grade_entity_1 = require("../grades/entities/grade.entity");
const academic_year_entity_1 = require("../academic-years/entities/academic-year.entity");
const guardians_service_1 = require("./guardians.service");
const pagination_1 = require("../../common/utils/pagination");
let StudentsService = class StudentsService {
    constructor(studentRepo, guardiansService, dataSource) {
        this.studentRepo = studentRepo;
        this.guardiansService = guardiansService;
        this.dataSource = dataSource;
    }
    async create(dto, schoolId) {
        if (!dto.guardianId && !dto.newGuardian) {
            throw new common_1.BadRequestException('باید یا guardianId یا اطلاعات یک والد جدید ارسال شود');
        }
        if (dto.guardianId && dto.newGuardian) {
            throw new common_1.BadRequestException('فقط یکی از guardianId یا newGuardian باید ارسال شود، نه هر دو');
        }
        return this.dataSource.transaction(async (manager) => {
            let guardianId = dto.guardianId;
            if (dto.newGuardian) {
                const guardian = await this.guardiansService.findOrCreate(dto.newGuardian, schoolId, manager);
                guardianId = guardian.id;
            }
            else if (dto.guardianId) {
                const guardian = await manager.findOne(guardian_entity_1.Guardian, {
                    where: { id: dto.guardianId },
                });
                if (!guardian) {
                    throw new common_1.NotFoundException('والد یافت نشد');
                }
                if (guardian.schoolId !== schoolId) {
                    throw new common_1.ForbiddenException('این والد متعلق به مدرسه دیگری است');
                }
            }
            const academicYear = await manager.findOne(academic_year_entity_1.AcademicYear, {
                where: { id: dto.academicYearId },
            });
            if (!academicYear) {
                throw new common_1.NotFoundException('سال تحصیلی یافت نشد');
            }
            if (academicYear.schoolId !== schoolId) {
                throw new common_1.ForbiddenException('این سال تحصیلی متعلق به مدرسه دیگری است');
            }
            const grade = await manager.findOne(grade_entity_1.Grade, { where: { id: dto.gradeId } });
            if (!grade) {
                throw new common_1.NotFoundException('پایه یافت نشد');
            }
            if (grade.schoolId !== schoolId) {
                throw new common_1.ForbiddenException('این پایه متعلق به مدرسه دیگری است');
            }
            const student = manager.getRepository(student_entity_1.Student).create({
                schoolId,
                guardianId,
                academicYearId: dto.academicYearId,
                gradeId: dto.gradeId,
                fullName: dto.fullName,
                nationalId: dto.nationalId ?? null,
                enrollmentDate: dto.enrollmentDate ?? null,
            });
            return manager.getRepository(student_entity_1.Student).save(student);
        });
    }
    async findWithFilters(query, schoolId) {
        const qb = this.studentRepo
            .createQueryBuilder('student')
            .leftJoinAndSelect('student.guardian', 'guardian')
            .leftJoinAndSelect('student.grade', 'grade')
            .where('student.schoolId = :schoolId', { schoolId });
        if (query.status) {
            qb.andWhere('student.status = :status', { status: query.status });
        }
        if (query.gradeId) {
            qb.andWhere('student.gradeId = :gradeId', { gradeId: query.gradeId });
        }
        if (query.academicYearId) {
            qb.andWhere('student.academicYearId = :academicYearId', {
                academicYearId: query.academicYearId,
            });
        }
        if (query.search) {
            qb.andWhere('student.fullName ILIKE :search', {
                search: `%${query.search}%`,
            });
        }
        const { limit, skip } = (0, pagination_1.normalizePagination)(query);
        return qb
            .orderBy('student.fullName', 'ASC')
            .skip(skip)
            .take(limit)
            .getMany();
    }
    async findOne(id, schoolId) {
        const student = await this.studentRepo.findOne({
            where: { id, schoolId },
            relations: ['guardian', 'grade', 'academicYear'],
        });
        if (!student) {
            throw new common_1.NotFoundException('دانش‌آموز یافت نشد');
        }
        return student;
    }
    async update(id, dto, schoolId) {
        const student = await this.findOne(id, schoolId);
        if (dto.gradeId !== undefined) {
            const grade = await this.dataSource
                .getRepository(grade_entity_1.Grade)
                .findOne({ where: { id: dto.gradeId } });
            if (!grade) {
                throw new common_1.NotFoundException('پایه یافت نشد');
            }
            if (grade.schoolId !== schoolId) {
                throw new common_1.ForbiddenException('این پایه متعلق به مدرسه دیگری است');
            }
        }
        Object.assign(student, dto);
        return this.studentRepo.save(student);
    }
    async softDelete(id, schoolId) {
        await this.findOne(id, schoolId);
        await this.studentRepo.softDelete(id);
    }
};
exports.StudentsService = StudentsService;
exports.StudentsService = StudentsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(student_entity_1.Student)),
    __param(2, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        guardians_service_1.GuardiansService,
        typeorm_2.DataSource])
], StudentsService);
//# sourceMappingURL=students.service.js.map