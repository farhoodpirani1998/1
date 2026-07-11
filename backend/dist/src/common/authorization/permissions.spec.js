"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const permissions_1 = require("./permissions");
const roles_enum_1 = require("./roles.enum");
describe('roleHasPermission', () => {
    it('grants super_admin every permission, even ones not listed in the map', () => {
        expect((0, permissions_1.roleHasPermission)(roles_enum_1.Role.SUPER_ADMIN, permissions_1.Permission.PAYMENT_VOID)).toBe(true);
        expect((0, permissions_1.roleHasPermission)(roles_enum_1.Role.SUPER_ADMIN, permissions_1.Permission.DISCOUNT_UNLIMITED)).toBe(true);
        expect((0, permissions_1.roleHasPermission)(roles_enum_1.Role.SUPER_ADMIN, permissions_1.Permission.INSTALLMENT_STATUS_OVERRIDE)).toBe(true);
    });
    it('grants school_admin PAYMENT_VOID, DISCOUNT_UNLIMITED, and INSTALLMENT_STATUS_OVERRIDE', () => {
        expect((0, permissions_1.roleHasPermission)(roles_enum_1.Role.SCHOOL_ADMIN, permissions_1.Permission.PAYMENT_VOID)).toBe(true);
        expect((0, permissions_1.roleHasPermission)(roles_enum_1.Role.SCHOOL_ADMIN, permissions_1.Permission.DISCOUNT_UNLIMITED)).toBe(true);
        expect((0, permissions_1.roleHasPermission)(roles_enum_1.Role.SCHOOL_ADMIN, permissions_1.Permission.INSTALLMENT_STATUS_OVERRIDE)).toBe(true);
    });
    it('denies accountant every fine-grained permission', () => {
        expect((0, permissions_1.roleHasPermission)(roles_enum_1.Role.ACCOUNTANT, permissions_1.Permission.PAYMENT_VOID)).toBe(false);
        expect((0, permissions_1.roleHasPermission)(roles_enum_1.Role.ACCOUNTANT, permissions_1.Permission.DISCOUNT_UNLIMITED)).toBe(false);
        expect((0, permissions_1.roleHasPermission)(roles_enum_1.Role.ACCOUNTANT, permissions_1.Permission.INSTALLMENT_STATUS_OVERRIDE)).toBe(false);
    });
    it('denies staff every fine-grained permission', () => {
        expect((0, permissions_1.roleHasPermission)(roles_enum_1.Role.STAFF, permissions_1.Permission.PAYMENT_VOID)).toBe(false);
        expect((0, permissions_1.roleHasPermission)(roles_enum_1.Role.STAFF, permissions_1.Permission.DISCOUNT_UNLIMITED)).toBe(false);
        expect((0, permissions_1.roleHasPermission)(roles_enum_1.Role.STAFF, permissions_1.Permission.INSTALLMENT_STATUS_OVERRIDE)).toBe(false);
    });
    it('denies an unrecognized role string rather than throwing', () => {
        expect((0, permissions_1.roleHasPermission)('some_made_up_role', permissions_1.Permission.PAYMENT_VOID)).toBe(false);
    });
});
describe('DISCOUNT_CEILING_RATIO', () => {
    it('caps accountant discounts at 10% of baseAmount', () => {
        expect(permissions_1.DISCOUNT_CEILING_RATIO[roles_enum_1.Role.ACCOUNTANT]).toBe(0.1);
    });
    it('gives staff a 0% ceiling (any discount needs escalation)', () => {
        expect(permissions_1.DISCOUNT_CEILING_RATIO[roles_enum_1.Role.STAFF]).toBe(0);
    });
});
//# sourceMappingURL=permissions.spec.js.map