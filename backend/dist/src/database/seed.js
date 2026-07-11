"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const typeorm_1 = require("typeorm");
const bcrypt = __importStar(require("bcrypt"));
const dotenv = __importStar(require("dotenv"));
const user_entity_1 = require("../modules/users/entities/user.entity");
const roles_enum_1 = require("../common/authorization/roles.enum");
dotenv.config();
const BCRYPT_ROUNDS = 12;
async function seed() {
    const phone = process.env.SEED_ADMIN_PHONE;
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!phone || !password) {
        console.error('Seed failed: SEED_ADMIN_PHONE and SEED_ADMIN_PASSWORD must both be set in the environment.');
        console.error('There is no default fallback for these — set them in .env before running `npm run seed`.');
        process.exit(1);
    }
    if (password.length < 8) {
        console.error('Seed failed: SEED_ADMIN_PASSWORD must be at least 8 characters.');
        process.exit(1);
    }
    const dataSource = new typeorm_1.DataSource({
        type: 'postgres',
        url: process.env.DATABASE_URL,
        entities: [user_entity_1.User],
    });
    await dataSource.initialize();
    const userRepo = dataSource.getRepository(user_entity_1.User);
    const existing = await userRepo.findOne({ where: { role: roles_enum_1.Role.SUPER_ADMIN } });
    if (existing) {
        console.log('A super_admin already exists — nothing to do.');
        await dataSource.destroy();
        return;
    }
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const admin = userRepo.create({
        schoolId: null,
        fullName: 'مدیر کل سیستم',
        phone,
        passwordHash,
        role: roles_enum_1.Role.SUPER_ADMIN,
        isActive: true,
    });
    await userRepo.save(admin);
    console.log('✅ super_admin created:');
    console.log(`   phone: ${phone}`);
    console.log(`   password: ${password}`);
    console.log('   Log in and change this password immediately.');
    await dataSource.destroy();
}
seed().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
});
//# sourceMappingURL=seed.js.map