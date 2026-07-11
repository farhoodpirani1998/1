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
exports.ParentService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const parent_student_entity_1 = require("./entities/parent-student.entity");
const user_entity_1 = require("../users/entities/user.entity");
const student_entity_1 = require("../students/entities/student.entity");
const tuition_plan_entity_1 = require("../tuition/entities/tuition-plan.entity");
const installment_entity_1 = require("../tuition/entities/installment.entity");
const payment_entity_1 = require("../tuition/entities/payment.entity");
const notification_entity_1 = require("../notifications/entities/notification.entity");
const roles_enum_1 = require("../../common/authorization/roles.enum");
const pagination_1 = require("../../common/utils/pagination");
const STUDENT_RELATIONS = ['student', 'student.grade', 'student.academicYear', 'student.school'];
let ParentService = class ParentService {
    constructor(parentStudentRepo, userRepo, studentRepo, tuitionPlanRepo, installmentRepo, paymentRepo, notificationRepo, dataSource) {
        this.parentStudentRepo = parentStudentRepo;
        this.userRepo = userRepo;
        this.studentRepo = studentRepo;
        this.tuitionPlanRepo = tuitionPlanRepo;
        this.installmentRepo = installmentRepo;
        this.paymentRepo = paymentRepo;
        this.notificationRepo = notificationRepo;
        this.dataSource = dataSource;
    }
    async link(dto, schoolId) {
        const parent = await this.userRepo.findOne({ where: { id: dto.parentId } });
        if (!parent) {
            throw new common_1.NotFoundException('والد یافت نشد');
        }
        if (parent.role !== roles_enum_1.Role.PARENT) {
            throw new common_1.BadRequestException('این کاربر نقش والد ندارد');
        }
        if (parent.schoolId !== schoolId) {
            throw new common_1.ForbiddenException('این والد متعلق به مدرسه دیگری است');
        }
        const student = await this.studentRepo.findOne({ where: { id: dto.studentId } });
        if (!student) {
            throw new common_1.NotFoundException('دانش‌آموز یافت نشد');
        }
        if (student.schoolId !== schoolId) {
            throw new common_1.ForbiddenException('این دانش‌آموز متعلق به مدرسه دیگری است');
        }
        const existing = await this.parentStudentRepo.findOne({
            where: { parentId: dto.parentId, studentId: dto.studentId },
        });
        if (existing) {
            return existing;
        }
        const link = this.parentStudentRepo.create({
            parentId: dto.parentId,
            studentId: dto.studentId,
        });
        return this.parentStudentRepo.save(link);
    }
    async unlink(id, schoolId) {
        const link = await this.parentStudentRepo.findOne({
            where: { id },
            relations: ['student'],
        });
        if (!link || link.student.schoolId !== schoolId) {
            throw new common_1.NotFoundException('این ارتباط یافت نشد');
        }
        await this.parentStudentRepo.delete(id);
    }
    async findMyStudents(parentId, schoolId) {
        const links = await this.parentStudentRepo.find({
            where: { parentId },
            relations: STUDENT_RELATIONS,
        });
        return links
            .map((link) => link.student)
            .filter((student) => student.schoolId === schoolId);
    }
    async findMyStudent(studentId, parentId, schoolId) {
        const link = await this.parentStudentRepo.findOne({
            where: { parentId, studentId },
            relations: STUDENT_RELATIONS,
        });
        if (!link || link.student.schoolId !== schoolId) {
            throw new common_1.NotFoundException('دانش‌آموز یافت نشد');
        }
        return link.student;
    }
    async getStudentTuition(studentId, parentId, schoolId) {
        await this.findMyStudent(studentId, parentId, schoolId);
        const plan = await this.tuitionPlanRepo
            .createQueryBuilder('plan')
            .innerJoin('plan.student', 'student')
            .leftJoinAndSelect('plan.academicYear', 'academicYear')
            .leftJoinAndSelect('plan.installments', 'installments')
            .where('plan.studentId = :studentId', { studentId })
            .andWhere('student.schoolId = :schoolId', { schoolId })
            .orderBy('plan.createdAt', 'DESC')
            .getOne();
        if (!plan) {
            throw new common_1.NotFoundException('برنامه شهریه برای این دانش‌آموز یافت نشد');
        }
        return plan;
    }
    async getStudentInstallments(studentId, parentId, schoolId) {
        await this.findMyStudent(studentId, parentId, schoolId);
        const installments = await this.installmentRepo
            .createQueryBuilder('installment')
            .innerJoin('installment.tuitionPlan', 'plan')
            .innerJoin('plan.student', 'student')
            .leftJoinAndSelect('installment.payments', 'payments')
            .where('plan.studentId = :studentId', { studentId })
            .andWhere('student.schoolId = :schoolId', { schoolId })
            .andWhere('payments.deletedAt IS NULL')
            .orderBy('installment.dueDate', 'ASC')
            .addOrderBy('installment.installmentNumber', 'ASC')
            .getMany();
        return installments;
    }
    async getStudentPaymentHistory(studentId, parentId, schoolId) {
        await this.findMyStudent(studentId, parentId, schoolId);
        const payments = await this.paymentRepo
            .createQueryBuilder('payment')
            .innerJoin('payment.installment', 'installment')
            .innerJoin('installment.tuitionPlan', 'plan')
            .innerJoin('plan.student', 'student')
            .where('plan.studentId = :studentId', { studentId })
            .andWhere('student.schoolId = :schoolId', { schoolId })
            .andWhere('payment.deletedAt IS NULL')
            .orderBy('payment.paidAt', 'DESC')
            .getMany();
        return payments;
    }
    async getMyNotifications(parentId, schoolId, query) {
        const qb = this.notificationRepo
            .createQueryBuilder('notification')
            .innerJoinAndSelect('notification.student', 'student')
            .innerJoinAndSelect('notification.installment', 'installment')
            .innerJoin('parent_students', 'ps', 'ps.student_id = notification.studentId AND ps.parent_id = :parentId', { parentId })
            .where('student.schoolId = :schoolId', { schoolId });
        if (query.isRead === true) {
            qb.andWhere('notification.readAt IS NOT NULL');
        }
        else if (query.isRead === false) {
            qb.andWhere('notification.readAt IS NULL');
        }
        const { limit, skip } = (0, pagination_1.normalizePagination)(query);
        return qb
            .orderBy('notification.createdAt', 'DESC')
            .skip(skip)
            .take(limit)
            .getMany();
    }
    async markNotificationRead(id, parentId, schoolId) {
        const notification = await this.notificationRepo
            .createQueryBuilder('notification')
            .innerJoinAndSelect('notification.student', 'student')
            .innerJoinAndSelect('notification.installment', 'installment')
            .innerJoin('parent_students', 'ps', 'ps.student_id = notification.studentId AND ps.parent_id = :parentId', { parentId })
            .where('notification.id = :id', { id })
            .andWhere('student.schoolId = :schoolId', { schoolId })
            .getOne();
        if (!notification) {
            throw new common_1.NotFoundException('اعلان یافت نشد');
        }
        if (!notification.readAt) {
            notification.readAt = new Date();
            await this.notificationRepo.save(notification);
        }
        return notification;
    }
};
exports.ParentService = ParentService;
exports.ParentService = ParentService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(parent_student_entity_1.ParentStudent)),
    __param(1, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(2, (0, typeorm_1.InjectRepository)(student_entity_1.Student)),
    __param(3, (0, typeorm_1.InjectRepository)(tuition_plan_entity_1.TuitionPlan)),
    __param(4, (0, typeorm_1.InjectRepository)(installment_entity_1.Installment)),
    __param(5, (0, typeorm_1.InjectRepository)(payment_entity_1.Payment)),
    __param(6, (0, typeorm_1.InjectRepository)(notification_entity_1.Notification)),
    __param(7, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource])
], ParentService);
//# sourceMappingURL=parent.service.js.map