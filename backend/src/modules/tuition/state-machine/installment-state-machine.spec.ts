import { BadRequestException } from '@nestjs/common';
import { InstallmentStateMachine } from './installment-state-machine';
import { InstallmentStatus } from '../entities/installment.entity';

describe('InstallmentStateMachine', () => {
  describe('assertTransition', () => {
    it('allows a no-op transition (same status to itself) from any state', () => {
      expect(() =>
        InstallmentStateMachine.assertTransition(InstallmentStatus.PAID, InstallmentStatus.PAID),
      ).not.toThrow();
      expect(() =>
        InstallmentStateMachine.assertTransition(
          InstallmentStatus.CANCELLED,
          InstallmentStatus.CANCELLED,
        ),
      ).not.toThrow();
    });

    it('allows PENDING -> PARTIAL -> PAID (the normal payment path)', () => {
      expect(() =>
        InstallmentStateMachine.assertTransition(InstallmentStatus.PENDING, InstallmentStatus.PARTIAL),
      ).not.toThrow();
      expect(() =>
        InstallmentStateMachine.assertTransition(InstallmentStatus.PARTIAL, InstallmentStatus.PAID),
      ).not.toThrow();
    });

    it('allows manual overrides from a live state (cancel/defer/dispute)', () => {
      for (const target of [
        InstallmentStatus.CANCELLED,
        InstallmentStatus.DEFERRED,
        InstallmentStatus.DISPUTED,
      ]) {
        expect(() =>
          InstallmentStateMachine.assertTransition(InstallmentStatus.PENDING, target),
        ).not.toThrow();
      }
    });

    it('rejects transitioning out of CANCELLED — it is terminal', () => {
      for (const target of [
        InstallmentStatus.PENDING,
        InstallmentStatus.PARTIAL,
        InstallmentStatus.PAID,
        InstallmentStatus.OVERDUE,
        InstallmentStatus.DEFERRED,
        InstallmentStatus.DISPUTED,
      ]) {
        expect(() =>
          InstallmentStateMachine.assertTransition(InstallmentStatus.CANCELLED, target),
        ).toThrow(BadRequestException);
      }
    });

    it('rejects PAID going straight to CANCELLED (must go through a void first)', () => {
      expect(() =>
        InstallmentStateMachine.assertTransition(InstallmentStatus.PAID, InstallmentStatus.CANCELLED),
      ).toThrow(BadRequestException);
    });

    it('allows a void to pull PAID back to PARTIAL or PENDING', () => {
      expect(() =>
        InstallmentStateMachine.assertTransition(InstallmentStatus.PAID, InstallmentStatus.PARTIAL),
      ).not.toThrow();
      expect(() =>
        InstallmentStateMachine.assertTransition(InstallmentStatus.PAID, InstallmentStatus.PENDING),
      ).not.toThrow();
    });

    it('rejects OVERDUE -> PENDING (an overdue installment cannot become newly pending automatically)', () => {
      expect(() =>
        InstallmentStateMachine.assertTransition(InstallmentStatus.OVERDUE, InstallmentStatus.PENDING),
      ).toThrow(BadRequestException);
    });

    it('allows resolving DISPUTED/DEFERRED back into a live state', () => {
      expect(() =>
        InstallmentStateMachine.assertTransition(InstallmentStatus.DISPUTED, InstallmentStatus.PENDING),
      ).not.toThrow();
      expect(() =>
        InstallmentStateMachine.assertTransition(InstallmentStatus.DEFERRED, InstallmentStatus.PARTIAL),
      ).not.toThrow();
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
      expect(InstallmentStateMachine.deriveFromAmounts(1000, 1000, futureStr)).toBe(
        InstallmentStatus.PAID,
      );
      expect(InstallmentStateMachine.deriveFromAmounts(1500, 1000, futureStr)).toBe(
        InstallmentStatus.PAID,
      );
    });

    it('returns PARTIAL when 0 < paidAmount < totalAmount, regardless of due date', () => {
      expect(InstallmentStateMachine.deriveFromAmounts(500, 1000, futureStr)).toBe(
        InstallmentStatus.PARTIAL,
      );
      expect(InstallmentStateMachine.deriveFromAmounts(500, 1000, pastStr)).toBe(
        InstallmentStatus.PARTIAL,
      );
    });

    it('returns OVERDUE when nothing paid and due date has passed', () => {
      expect(InstallmentStateMachine.deriveFromAmounts(0, 1000, pastStr)).toBe(
        InstallmentStatus.OVERDUE,
      );
    });

    it('returns PENDING when nothing paid and due date is in the future', () => {
      expect(InstallmentStateMachine.deriveFromAmounts(0, 1000, futureStr)).toBe(
        InstallmentStatus.PENDING,
      );
    });
  });

  describe('isLiveState', () => {
    it('treats PENDING, PARTIAL, and OVERDUE as live', () => {
      expect(InstallmentStateMachine.isLiveState(InstallmentStatus.PENDING)).toBe(true);
      expect(InstallmentStateMachine.isLiveState(InstallmentStatus.PARTIAL)).toBe(true);
      expect(InstallmentStateMachine.isLiveState(InstallmentStatus.OVERDUE)).toBe(true);
    });

    it('treats PAID, CANCELLED, DEFERRED, DISPUTED as not-live', () => {
      expect(InstallmentStateMachine.isLiveState(InstallmentStatus.PAID)).toBe(false);
      expect(InstallmentStateMachine.isLiveState(InstallmentStatus.CANCELLED)).toBe(false);
      expect(InstallmentStateMachine.isLiveState(InstallmentStatus.DEFERRED)).toBe(false);
      expect(InstallmentStateMachine.isLiveState(InstallmentStatus.DISPUTED)).toBe(false);
    });
  });
});
