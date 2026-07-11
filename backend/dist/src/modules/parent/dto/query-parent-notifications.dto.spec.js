"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const query_parent_notifications_dto_1 = require("./query-parent-notifications.dto");
describe('QueryParentNotificationsDto boolean conversion', () => {
    it('converts the string "true" to boolean true', async () => {
        const dto = (0, class_transformer_1.plainToInstance)(query_parent_notifications_dto_1.QueryParentNotificationsDto, { isRead: 'true' });
        expect(dto.isRead).toBe(true);
        expect(await (0, class_validator_1.validate)(dto)).toHaveLength(0);
    });
    it('converts the string "false" to boolean false, not truthy', async () => {
        const dto = (0, class_transformer_1.plainToInstance)(query_parent_notifications_dto_1.QueryParentNotificationsDto, { isRead: 'false' });
        expect(dto.isRead).toBe(false);
        expect(await (0, class_validator_1.validate)(dto)).toHaveLength(0);
    });
    it('leaves isRead undefined when the query param is absent', async () => {
        const dto = (0, class_transformer_1.plainToInstance)(query_parent_notifications_dto_1.QueryParentNotificationsDto, {});
        expect(dto.isRead).toBeUndefined();
        expect(await (0, class_validator_1.validate)(dto)).toHaveLength(0);
    });
    it('rejects any value other than "true"/"false" instead of coercing it', async () => {
        const dto = (0, class_transformer_1.plainToInstance)(query_parent_notifications_dto_1.QueryParentNotificationsDto, { isRead: 'notabool' });
        const errors = await (0, class_validator_1.validate)(dto);
        expect(errors).toHaveLength(1);
        expect(errors[0].property).toBe('isRead');
    });
    it('accepts page/limit as numeric strings, same as the other list DTOs', async () => {
        const dto = (0, class_transformer_1.plainToInstance)(query_parent_notifications_dto_1.QueryParentNotificationsDto, { page: '2', limit: '10' });
        expect(dto.page).toBe(2);
        expect(dto.limit).toBe(10);
        expect(await (0, class_validator_1.validate)(dto)).toHaveLength(0);
    });
});
//# sourceMappingURL=query-parent-notifications.dto.spec.js.map