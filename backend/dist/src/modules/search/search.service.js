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
exports.SearchService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const student_entity_1 = require("../students/entities/student.entity");
const guardian_entity_1 = require("../students/entities/guardian.entity");
const user_entity_1 = require("../users/entities/user.entity");
const subject_entity_1 = require("../student-assessments/entities/subject.entity");
const homework_entity_1 = require("../homework/entities/homework.entity");
const announcement_entity_1 = require("../announcements/entities/announcement.entity");
const roles_enum_1 = require("../../common/authorization/roles.enum");
const search_result_view_dto_1 = require("./dto/search-result-view.dto");
const DEFAULT_SEARCH_LIMIT = 10;
const MAX_SEARCH_LIMIT = 50;
let SearchService = class SearchService {
    constructor(studentRepo, guardianRepo, userRepo, subjectRepo, homeworkRepo, announcementRepo) {
        this.studentRepo = studentRepo;
        this.guardianRepo = guardianRepo;
        this.userRepo = userRepo;
        this.subjectRepo = subjectRepo;
        this.homeworkRepo = homeworkRepo;
        this.announcementRepo = announcementRepo;
    }
    async search(query, schoolId) {
        const term = query.q.trim();
        const limit = this.normalizeLimit(query.limit);
        if (!term) {
            return { students: [], parents: [], teachers: [], subjects: [], homework: [], announcements: [] };
        }
        const like = `%${term}%`;
        const [students, parents, teachers, subjects, homework, announcements] = await Promise.all([
            this.searchStudents(like, schoolId, limit),
            this.searchParents(like, schoolId, limit),
            this.searchTeachers(like, schoolId, limit),
            this.searchSubjects(like, schoolId, limit),
            this.searchHomework(like, schoolId, limit),
            this.searchAnnouncements(like, schoolId, limit),
        ]);
        return {
            students: students.map(search_result_view_dto_1.toStudentSearchResult),
            parents: parents.map(search_result_view_dto_1.toParentSearchResult),
            teachers: teachers.map(search_result_view_dto_1.toTeacherSearchResult),
            subjects: subjects.map(search_result_view_dto_1.toSubjectSearchResult),
            homework: homework.map(search_result_view_dto_1.toHomeworkSearchResult),
            announcements: announcements.map(search_result_view_dto_1.toAnnouncementSearchResult),
        };
    }
    searchStudents(like, schoolId, limit) {
        return this.studentRepo
            .createQueryBuilder('student')
            .where('student.schoolId = :schoolId', { schoolId })
            .andWhere('(student.fullName ILIKE :like OR student.nationalId ILIKE :like)', { like })
            .orderBy('student.fullName', 'ASC')
            .take(limit)
            .getMany();
    }
    searchParents(like, schoolId, limit) {
        return this.guardianRepo
            .createQueryBuilder('guardian')
            .where('guardian.schoolId = :schoolId', { schoolId })
            .andWhere('(guardian.fullName ILIKE :like OR guardian.phone ILIKE :like)', { like })
            .orderBy('guardian.fullName', 'ASC')
            .take(limit)
            .getMany();
    }
    searchTeachers(like, schoolId, limit) {
        return this.userRepo
            .createQueryBuilder('user')
            .where('user.schoolId = :schoolId', { schoolId })
            .andWhere('user.role = :role', { role: roles_enum_1.Role.TEACHER })
            .andWhere('(user.fullName ILIKE :like OR user.phone ILIKE :like)', { like })
            .orderBy('user.fullName', 'ASC')
            .take(limit)
            .getMany();
    }
    searchSubjects(like, schoolId, limit) {
        return this.subjectRepo
            .createQueryBuilder('subject')
            .where('subject.schoolId = :schoolId', { schoolId })
            .andWhere('subject.title ILIKE :like', { like })
            .orderBy('subject.title', 'ASC')
            .take(limit)
            .getMany();
    }
    searchHomework(like, schoolId, limit) {
        return this.homeworkRepo
            .createQueryBuilder('homework')
            .where('homework.schoolId = :schoolId', { schoolId })
            .andWhere('(homework.title ILIKE :like OR homework.description ILIKE :like)', { like })
            .orderBy('homework.dueDate', 'DESC')
            .take(limit)
            .getMany();
    }
    searchAnnouncements(like, schoolId, limit) {
        return this.announcementRepo
            .createQueryBuilder('announcement')
            .where('announcement.schoolId = :schoolId', { schoolId })
            .andWhere('(announcement.title ILIKE :like OR announcement.message ILIKE :like)', { like })
            .orderBy('announcement.createdAt', 'DESC')
            .take(limit)
            .getMany();
    }
    normalizeLimit(limit) {
        if (!limit || limit < 1) {
            return DEFAULT_SEARCH_LIMIT;
        }
        return Math.min(Math.floor(limit), MAX_SEARCH_LIMIT);
    }
};
exports.SearchService = SearchService;
exports.SearchService = SearchService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(student_entity_1.Student)),
    __param(1, (0, typeorm_1.InjectRepository)(guardian_entity_1.Guardian)),
    __param(2, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(3, (0, typeorm_1.InjectRepository)(subject_entity_1.Subject)),
    __param(4, (0, typeorm_1.InjectRepository)(homework_entity_1.Homework)),
    __param(5, (0, typeorm_1.InjectRepository)(announcement_entity_1.Announcement)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], SearchService);
//# sourceMappingURL=search.service.js.map