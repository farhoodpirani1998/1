"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const installment_state_machine_1 = require("./installment-state-machine");
const installment_entity_1 = require("../entities/installment.entity");
describe('InstallmentStateMachine', () => {
    describe('assertTransition', () => {
        it('allows a no-op transition (same status to itself) from any state', () => {
            expect(() => installment_state_machine_1.InstallmentStateMachine.assertTransition(installment_entity_1.InstallmentStatus.PAID, installment_entity_1.InstallmentStatus.PAID)).not.toThrow();
            expect(() => installment_state_machine_1.InstallmentStateMachine.assertTransition(installment_entity_1.InstallmentStatus.CANCELLED, installment_entity_1.InstallmentStatus.CANCELLED)).not.toThrow();
        });
        it('allows PENDING -> PARTIAL -> PAID (the normal payment path)', () => {
            expect(() => installment_state_machine_1.InstallmentStateMachine.assertTransition(installment_entity_1.InstallmentStatus.PENDING, installment_entity_1.InstallmentStatus.PARTIAL)).not.toThrow();
            expect(() => installment_state_machine_1.InstallmentStateMachine.assertTransition(installment_entity_1.InstallmentStatus.PARTIAL, installment_entity_1.InstallmentStatus.PAID)).not.toThrow();
        });
        it('allows manual overrides from a live state (cancel/defer/dispute)', () => {
            for (const target of [
                installment_entity_1.InstallmentStatus.CANCELLED,
                installment_entity_1.InstallmentStatus.DEFERRED,
                installment_entity_1.InstallmentStatus.DISPUTED,
            ]) {
                expect(() => installment_state_machine_1.InstallmentStateMachine.assertTransition(installment_entity_1.InstallmentStatus.PENDING, target)).not.toThrow();
            }
        });
        it('rejects transitioning out of CANCELLED — it is terminal', () => {
            for (const target of [
                installment_entity_1.InstallmentStatus.PENDING,
                installment_entity_1.InstallmentStatus.PARTIAL,
                installment_entity_1.InstallmentStatus.PAID,
                installment_entity_1.InstallmentStatus.OVERDUE,
                installment_entity_1.InstallmentStatus.DEFERRED,
                installment_entity_1.InstallmentStatus.DISPUTED,
            ]) {
                expect(() => installment_state_machine_1.InstallmentStateMachine.assertTransition(installment_entity_1.InstallmentStatus.CANCELLED, target)).toThrow(common_1.BadRequestException);
            }
        });
        it('rejects PAID going straight to CANCELLED (must go through a void first)', () => {
            expect(() => installment_state_machine_1.InstallmentStateMachine.assertTransition(installment_entity_1.InstallmentStatus.PAID, installment_entity_1.InstallmentStatus.CANCELLED)).toThrow(common_1.BadRequestException);
        });
        it('allows a void to pull PAID back to PARTIAL or PENDING', () => {
            expect(() => installment_state_machine_1.InstallmentStateMachine.assertTransition(installment_entity_1.InstallmentStatus.PAID, installment_entity_1.InstallmentStatus.PARTIAL)).not.toThrow();
            expect(() => installment_state_machine_1.InstallmentStateMachine.assertTransition(installment_entity_1.InstallmentStatus.PAID, installment_entity_1.InstallmentStatus.PENDING)).not.toThrow();
        });
        it('rejects OVERDUE -> PENDING (an overdue installment cannot become newly pending automatically)', () => {
            expect(() => installment_state_machine_1.InstallmentStateMachine.assertTransition(installment_entity_1.InstallmentStatus.OVERDUE, installment_entity_1.InstallmentStatus.PENDING)).toThrow(common_1.BadRequestException);
        });
        it('allows resolving DISPUTED/DEFERRED back into a live state', () => {
            expect(() => installment_state_machine_1.InstallmentStateMachine.assertTransition(installment_entity_1.InstallmentStatus.DISPUTED, installment_entity_1.InstallmentStatus.PENDING)).not.toThrow();
            expect(() => installment_state_machine_1.InstallmentStateMachine.assertTransition(installment_entity_1.InstallmentStatus.DEFERRED, installment_entity_1.InstallmentStatus.PARTIAL)).not.toThrow();
        });
    });
    describe('deriveFromAmounts', () => {
        const future = new Date();
        future.setDate(future.getDate() + 30);
        const futureStr = future.toISOString().slice(0, 10);
        const past = new Date();
        past.setDate(past.getDate() - 30);
        const pastStr = past.toISOString().slice(0, 10);
        it('returns PAID when paidAmount >= totalAmount', () => {
            expect(installment_state_machine_1.InstallmentStateMachine.deriveFromAmounts(1000, 1000, futureStr)).toBe(installment_entity_1.InstallmentStatus.PAID);
            expect(installment_state_machine_1.InstallmentStateMachine.deriveFromAmounts(1500, 1000, futureStr)).toBe(installment_entity_1.InstallmentStatus.PAID);
        });
        it('returns PARTIAL when 0 < paidAmount < totalAmount, regardless of due date', () => {
            expect(installment_state_machine_1.InstallmentStateMachine.deriveFromAmounts(500, 1000, futureStr)).toBe(installment_entity_1.InstallmentStatus.PARTIAL);
            expect(installment_state_machine_1.InstallmentStateMachine.deriveFromAmounts(500, 1000, pastStr)).toBe(installment_entity_1.InstallmentStatus.PARTIAL);
        });
        it('returns OVERDUE when nothing paid and due date has passed', () => {
            expect(installment_state_machine_1.InstallmentStateMachine.deriveFromAmounts(0, 1000, pastStr)).toBe(installment_entity_1.InstallmentStatus.OVERDUE);
        });
        it('returns PENDING when nothing paid and due date is in the future', () => {
            expect(installment_state_machine_1.InstallmentStateMachine.deriveFromAmounts(0, 1000, futureStr)).toBe(installment_entity_1.InstallmentStatus.PENDING);
        });
    });
    describe('isLiveState', () => {
        it('treats PENDING, PARTIAL, and OVERDUE as live', () => {
            expect(installment_state_machine_1.InstallmentStateMachine.isLiveState(installment_entity_1.InstallmentStatus.PENDING)).toBe(true);
            expect(installment_state_machine_1.InstallmentStateMachine.isLiveState(installment_entity_1.InstallmentStatus.PARTIAL)).toBe(true);
            expect(installment_state_machine_1.InstallmentStateMachine.isLiveState(installment_entity_1.InstallmentStatus.OVERDUE)).toBe(true);
        });
        it('treats PAID, CANCELLED, DEFERRED, DISPUTED as not-live', () => {
            expect(installment_state_machine_1.InstallmentStateMachine.isLiveState(installment_entity_1.InstallmentStatus.PAID)).toBe(false);
            expect(installment_state_machine_1.InstallmentStateMachine.isLiveState(installment_entity_1.InstallmentStatus.CANCELLED)).toBe(false);
            expect(installment_state_machine_1.InstallmentStateMachine.isLiveState(installment_entity_1.InstallmentStatus.DEFERRED)).toBe(false);
            expect(installment_state_machine_1.InstallmentStateMachine.isLiveState(installment_entity_1.InstallmentStatus.DISPUTED)).toBe(false);
        });
    });
});
//# sourceMappingURL=installment-state-machine.spec.js.map