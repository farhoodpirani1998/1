"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParentTuitionViewDto = void 0;
exports.toParentTuitionView = toParentTuitionView;
class ParentTuitionViewDto {
}
exports.ParentTuitionViewDto = ParentTuitionViewDto;
function toParentTuitionView(plan) {
    return {
        id: plan.id,
        academicYearTitle: plan.academicYear?.title ?? '',
        baseAmount: Number(plan.baseAmount),
        discountAmount: Number(plan.discountAmount),
        finalAmount: Number(plan.finalAmount),
        createdAt: plan.createdAt,
    };
}
//# sourceMappingURL=parent-tuition-view.dto.js.map