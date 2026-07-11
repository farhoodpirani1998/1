"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LedgerService = void 0;
const common_1 = require("@nestjs/common");
const ledger_entry_entity_1 = require("./entities/ledger-entry.entity");
let LedgerService = class LedgerService {
    async recordCharge(manager, params) {
        const entries = [
            {
                schoolId: params.schoolId,
                studentId: params.studentId,
                tuitionPlanId: params.tuitionPlanId,
                entryType: ledger_entry_entity_1.LedgerEntryType.CHARGE,
                amount: params.baseAmount,
                referenceType: ledger_entry_entity_1.LedgerReferenceType.TUITION_PLAN,
                referenceId: params.tuitionPlanId,
                performedById: params.performedBy,
            },
        ];
        if (params.discountAmount > 0) {
            entries.push({
                schoolId: params.schoolId,
                studentId: params.studentId,
                tuitionPlanId: params.tuitionPlanId,
                entryType: ledger_entry_entity_1.LedgerEntryType.DISCOUNT,
                amount: -params.discountAmount,
                referenceType: ledger_entry_entity_1.LedgerReferenceType.TUITION_PLAN,
                referenceId: params.tuitionPlanId,
                performedById: params.performedBy,
            });
        }
        await manager.getRepository(ledger_entry_entity_1.LedgerEntry).insert(entries);
    }
    async recordDiscountAdjustment(manager, params) {
        if (params.deltaDiscount === 0)
            return;
        await manager.getRepository(ledger_entry_entity_1.LedgerEntry).insert({
            schoolId: params.schoolId,
            studentId: params.studentId,
            tuitionPlanId: params.tuitionPlanId,
            entryType: ledger_entry_entity_1.LedgerEntryType.DISCOUNT,
            amount: -params.deltaDiscount,
            referenceType: ledger_entry_entity_1.LedgerReferenceType.TUITION_PLAN,
            referenceId: params.tuitionPlanId,
            performedById: params.performedBy,
            reason: params.reason ?? null,
        });
    }
    async recordPayment(manager, params) {
        await manager.getRepository(ledger_entry_entity_1.LedgerEntry).insert({
            schoolId: params.schoolId,
            studentId: params.studentId,
            tuitionPlanId: params.tuitionPlanId,
            entryType: ledger_entry_entity_1.LedgerEntryType.PAYMENT,
            amount: -params.amount,
            referenceType: ledger_entry_entity_1.LedgerReferenceType.PAYMENT,
            referenceId: params.paymentId,
            performedById: params.performedBy,
        });
    }
    async recordVoid(manager, params) {
        await manager.getRepository(ledger_entry_entity_1.LedgerEntry).insert({
            schoolId: params.schoolId,
            studentId: params.studentId,
            tuitionPlanId: params.tuitionPlanId,
            entryType: ledger_entry_entity_1.LedgerEntryType.VOID,
            amount: params.amount,
            referenceType: ledger_entry_entity_1.LedgerReferenceType.PAYMENT,
            referenceId: params.paymentId,
            performedById: params.performedBy,
            reason: params.reason,
        });
    }
    async studentBalance(manager, studentId) {
        const raw = await manager
            .getRepository(ledger_entry_entity_1.LedgerEntry)
            .createQueryBuilder('l')
            .where('l.studentId = :studentId', { studentId })
            .select('COALESCE(SUM(l.amount), 0)', 'balance')
            .getRawOne();
        return Number(raw?.balance ?? 0);
    }
};
exports.LedgerService = LedgerService;
exports.LedgerService = LedgerService = __decorate([
    (0, common_1.Injectable)()
], LedgerService);
//# sourceMappingURL=ledger.service.js.map