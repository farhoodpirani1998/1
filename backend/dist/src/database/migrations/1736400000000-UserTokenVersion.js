"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserTokenVersion1736400000000 = void 0;
class UserTokenVersion1736400000000 {
    constructor() {
        this.name = 'UserTokenVersion1736400000000';
    }
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN token_version integer NOT NULL DEFAULT 0;
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE users
        DROP COLUMN token_version;
    `);
    }
}
exports.UserTokenVersion1736400000000 = UserTokenVersion1736400000000;
//# sourceMappingURL=1736400000000-UserTokenVersion.js.map