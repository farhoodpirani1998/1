"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DISCOUNT_CEILING_RATIO = exports.Permission = void 0;
exports.roleHasPermission = roleHasPermission;
const roles_enum_1 = require("./roles.enum");
var Permission;
(function (Permission) {
    Permission["PAYMENT_VOID"] = "payment:void";
    Permission["DISCOUNT_UNLIMITED"] = "discount:unlimited";
    Permission["INSTALLMENT_STATUS_OVERRIDE"] = "installment:status-override";
})(Permission || (exports.Permission = Permission = {}));
const ROLE_PERMISSIONS = {
    [roles_enum_1.Role.SCHOOL_ADMIN]: [
        Permission.PAYMENT_VOID,
        Permission.DISCOUNT_UNLIMITED,
        Permission.INSTALLMENT_STATUS_OVERRIDE,
    ],
    [roles_enum_1.Role.ACCOUNTANT]: [],
    [roles_enum_1.Role.STAFF]: [],
    [roles_enum_1.Role.PARENT]: [],
    [roles_enum_1.Role.TEACHER]: [],
};
function roleHasPermission(role, permission) {
    if (role === roles_enum_1.Role.SUPER_ADMIN)
        return true;
    return (ROLE_PERMISSIONS[role] ?? []).includes(permission);
}
exports.DISCOUNT_CEILING_RATIO = {
    [roles_enum_1.Role.ACCOUNTANT]: 0.1,
    [roles_enum_1.Role.STAFF]: 0,
    [roles_enum_1.Role.SCHOOL_ADMIN]: 1,
};
//# sourceMappingURL=permissions.js.map