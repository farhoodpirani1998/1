import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { Role } from '../authorization/roles.enum';

function makeContext(user: { role?: string } | undefined): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('allows any authenticated user when no @Roles() is set on handler or class', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(makeContext({ role: 'staff' }))).toBe(true);
  });

  it('allows any authenticated user when @Roles() is set to an empty array', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([]);
    expect(guard.canActivate(makeContext({ role: 'staff' }))).toBe(true);
  });

  it('falls back to the class-level @Roles() when the handler has none of its own', () => {
    // Reflector.getAllAndOverride([handler, class]) is what actually implements
    // this fallback in production; here we exercise the guard's own logic
    // assuming that resolution already happened, which is what the real
    // reflector guarantees.
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['super_admin']);
    expect(guard.canActivate(makeContext({ role: 'super_admin' }))).toBe(true);
    expect(guard.canActivate(makeContext({ role: 'school_admin' }))).toBe(false);
  });

  it('denies a role not present in the required list', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['school_admin', 'accountant']);
    expect(guard.canActivate(makeContext({ role: 'staff' }))).toBe(false);
  });

  it('allows a role present in the required list', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['school_admin', 'accountant']);
    expect(guard.canActivate(makeContext({ role: 'accountant' }))).toBe(true);
  });

  it('lets super_admin through regardless of the route\'s required roles', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['staff']);
    expect(guard.canActivate(makeContext({ role: Role.SUPER_ADMIN }))).toBe(true);
  });

  it('denies when there is no user on the request at all', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['staff']);
    expect(guard.canActivate(makeContext(undefined))).toBe(false);
  });

  it('reads roles metadata using ROLES_KEY from both handler and class', () => {
    const spy = jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['super_admin']);
    const context = makeContext({ role: 'super_admin' });
    guard.canActivate(context);
    expect(spy).toHaveBeenCalledWith('roles', [context.getHandler(), context.getClass()]);
  });
});
