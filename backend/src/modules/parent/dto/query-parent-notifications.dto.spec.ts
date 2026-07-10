import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { QueryParentNotificationsDto } from './query-parent-notifications.dto';

/**
 * Phase 5C: `isRead` is a query-string parameter, so it always arrives as
 * the literal text "true"/"false" (or is absent) — never a real boolean.
 * These tests guard against the naive-but-wrong fix, `Boolean(value)`,
 * under which Boolean('false') is `true` and would silently invert the
 * unread/read filter.
 */
describe('QueryParentNotificationsDto boolean conversion', () => {
  it('converts the string "true" to boolean true', async () => {
    const dto = plainToInstance(QueryParentNotificationsDto, { isRead: 'true' });
    expect(dto.isRead).toBe(true);
    expect(await validate(dto)).toHaveLength(0);
  });

  it('converts the string "false" to boolean false, not truthy', async () => {
    const dto = plainToInstance(QueryParentNotificationsDto, { isRead: 'false' });
    expect(dto.isRead).toBe(false);
    expect(await validate(dto)).toHaveLength(0);
  });

  it('leaves isRead undefined when the query param is absent', async () => {
    const dto = plainToInstance(QueryParentNotificationsDto, {});
    expect(dto.isRead).toBeUndefined();
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects any value other than "true"/"false" instead of coercing it', async () => {
    const dto = plainToInstance(QueryParentNotificationsDto, { isRead: 'notabool' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('isRead');
  });

  it('accepts page/limit as numeric strings, same as the other list DTOs', async () => {
    const dto = plainToInstance(QueryParentNotificationsDto, { page: '2', limit: '10' });
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(10);
    expect(await validate(dto)).toHaveLength(0);
  });
});
