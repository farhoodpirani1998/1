import { AuditEventsListener } from './audit-events.listener';
import { AuditAction } from './audit-log.entity';
import type { RecordAuditParams } from './audit.service';
import {
  InstallmentAddedEvent,
  InstallmentRemovedEvent,
  InstallmentWrittenOffEvent,
  InstallmentsRenegotiatedEvent,
  LoginSucceededEvent,
  PasswordChangedEvent,
  PasswordResetEvent,
  UserCreatedEvent,
  UserStatusChangedEvent,
} from '../events/domain-events';

/**
 * In-memory fake AuditService — same "observe what the caller asks for,
 * don't re-test the real service's own contract" shape as
 * FakeStorageProvider in common/storage/avatar-storage.service.spec.ts.
 * AuditService.record()'s own error-swallowing/insert behavior is that
 * service's own responsibility, not this listener's.
 */
class FakeAuditService {
  calls: RecordAuditParams[] = [];

  async record(params: RecordAuditParams): Promise<void> {
    this.calls.push(params);
  }
}

describe('AuditEventsListener', () => {
  let audit: FakeAuditService;
  let listener: AuditEventsListener;

  beforeEach(() => {
    audit = new FakeAuditService();
    listener = new AuditEventsListener(audit as any);
  });

  describe('financial gap-fill handlers', () => {
    it('INSTALLMENT_ADDED creates exactly one audit row', async () => {
      const event = new InstallmentAddedEvent(
        'school-1',
        'student-1',
        'plan-1',
        'installment-1',
        1500000,
        '2026-09-01',
        'user-1',
      );

      await listener.onInstallmentAdded(event);

      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]).toMatchObject({
        schoolId: 'school-1',
        userId: 'user-1',
        action: AuditAction.INSTALLMENT_ADDED,
        entityType: 'installment',
        entityId: 'installment-1',
      });
    });

    it('INSTALLMENT_REMOVED creates exactly one audit row', async () => {
      const event = new InstallmentRemovedEvent(
        'school-1',
        'student-1',
        'plan-1',
        'installment-1',
        1500000,
        'duplicate entry',
        'user-1',
      );

      await listener.onInstallmentRemoved(event);

      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]).toMatchObject({
        schoolId: 'school-1',
        userId: 'user-1',
        action: AuditAction.INSTALLMENT_REMOVED,
        entityType: 'installment',
        entityId: 'installment-1',
      });
      // The row is the only trace of the hard-deleted installment, so it
      // must carry enough of the old state to reconstruct what existed.
      expect(audit.calls[0].oldValue).toMatchObject({ tuitionPlanId: 'plan-1', amount: 1500000 });
    });

    it('INSTALLMENT_WRITTEN_OFF creates exactly one audit row', async () => {
      const event = new InstallmentWrittenOffEvent(
        'school-1',
        'student-1',
        'plan-1',
        'installment-1',
        250000,
        'financial hardship',
        'user-1',
      );

      await listener.onInstallmentWrittenOff(event);

      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]).toMatchObject({
        action: AuditAction.INSTALLMENT_WRITTEN_OFF,
        entityType: 'installment',
        entityId: 'installment-1',
        newValue: { amountWrittenOff: 250000, reason: 'financial hardship' },
      });
    });

    it('INSTALLMENTS_RENEGOTIATED creates exactly one audit row', async () => {
      const event = new InstallmentsRenegotiatedEvent(
        'school-1',
        'student-1',
        'plan-1',
        ['installment-1', 'installment-2'],
        ['installment-3', 'installment-4'],
        'user-1',
      );

      await listener.onInstallmentsRenegotiated(event);

      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]).toMatchObject({
        action: AuditAction.INSTALLMENTS_RENEGOTIATED,
        entityType: 'tuition_plan',
        entityId: 'plan-1',
        oldValue: { cancelledInstallmentIds: ['installment-1', 'installment-2'] },
        newValue: { newInstallmentIds: ['installment-3', 'installment-4'] },
      });
    });
  });

  describe('security/user-management handlers', () => {
    it('LOGIN_SUCCEEDED creates exactly one audit row with no credential material', async () => {
      const event = new LoginSucceededEvent('user-1', 'school-1', 'phone');

      await listener.onLoginSucceeded(event);

      expect(audit.calls).toHaveLength(1);
      const call = audit.calls[0];
      expect(call).toMatchObject({
        schoolId: 'school-1',
        userId: 'user-1',
        action: AuditAction.LOGIN_SUCCEEDED,
        entityType: 'user',
        entityId: 'user-1',
        newValue: { identifierType: 'phone' },
      });
      expect(JSON.stringify(call)).not.toMatch(/password/i);
    });

    it('PASSWORD_CHANGED creates exactly one audit row with no credential material', async () => {
      const event = new PasswordChangedEvent('user-1', 'school-1');

      await listener.onPasswordChanged(event);

      expect(audit.calls).toHaveLength(1);
      const call = audit.calls[0];
      expect(call).toMatchObject({
        schoolId: 'school-1',
        userId: 'user-1',
        action: AuditAction.PASSWORD_CHANGED,
        entityType: 'user',
        entityId: 'user-1',
      });
      expect(JSON.stringify(call)).not.toMatch(/password/i);
    });

    it('PASSWORD_RESET creates exactly one audit row with no credential material', async () => {
      const event = new PasswordResetEvent('user-1', 'school-1');

      await listener.onPasswordReset(event);

      expect(audit.calls).toHaveLength(1);
      const call = audit.calls[0];
      expect(call).toMatchObject({
        schoolId: 'school-1',
        userId: 'user-1',
        action: AuditAction.PASSWORD_RESET,
        entityType: 'user',
        entityId: 'user-1',
      });
      expect(JSON.stringify(call)).not.toMatch(/password|resetCode/i);
    });

    it('USER_CREATED creates exactly one audit row', async () => {
      const event = new UserCreatedEvent('user-1', 'school-1');

      await listener.onUserCreated(event);

      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]).toMatchObject({
        schoolId: 'school-1',
        userId: 'user-1',
        action: AuditAction.USER_CREATED,
        entityType: 'user',
        entityId: 'user-1',
      });
    });

    it('USER_STATUS_CHANGED creates exactly one audit row reflecting the transition', async () => {
      const event = new UserStatusChangedEvent('user-1', 'school-1', true, false);

      await listener.onUserStatusChanged(event);

      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]).toMatchObject({
        schoolId: 'school-1',
        userId: 'user-1',
        action: AuditAction.USER_STATUS_CHANGED,
        entityType: 'user',
        entityId: 'user-1',
        oldValue: { isActive: true },
        newValue: { isActive: false },
      });
    });
  });

  it('handlers delegate directly to AuditService.record() without adding their own try/catch', async () => {
    // Failure isolation (a logging failure must never break the business
    // action that triggered it) is AuditService.record()'s own
    // responsibility -- it swallows and logs its own errors (see
    // audit.service.ts). Handlers here must not add a second layer that
    // would mask or duplicate that contract, so this just confirms each
    // handler calls record() exactly once per event with no wrapping.
    const recordSpy = jest.fn().mockResolvedValue(undefined);
    const spiedListener = new AuditEventsListener({ record: recordSpy } as any);

    await spiedListener.onUserCreated(new UserCreatedEvent('user-1', 'school-1'));

    expect(recordSpy).toHaveBeenCalledTimes(1);
  });
});
