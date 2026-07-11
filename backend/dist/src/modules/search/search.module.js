"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const student_entity_1 = require("../students/entities/student.entity");
const guardian_entity_1 = require("../students/entities/guardian.entity");
const user_entity_1 = require("../users/entities/user.entity");
const subject_entity_1 = require("../student-assessments/entities/subject.entity");
const homework_entity_1 = require("../homework/entities/homework.entity");
const announcement_entity_1 = require("../announcements/entities/announcement.entity");
const search_controller_1 = require("./search.controller");
const search_service_1 = require("./search.service");
let SearchModule = class SearchModule {
};
exports.SearchModule = SearchModule;
exports.SearchModule = SearchModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([student_entity_1.Student, guardian_entity_1.Guardian, user_entity_1.User, subject_entity_1.Subject, homework_entity_1.Homework, announcement_entity_1.Announcement]),
        ],
        controllers: [search_controller_1.SearchController],
        providers: [search_service_1.SearchService],
        exports: [search_service_1.SearchService],
    })
], SearchModule);
//# sourceMappingURL=search.module.js.map