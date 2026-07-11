"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jalali_1 = require("./jalali");
describe('gregorianToJalaliYear', () => {
    it.each([
        ['2020-07-01', 1399],
        ['2024-07-01', 1403],
        ['2025-07-01', 1404],
        ['2025-01-01', 1403],
        ['2026-07-09', 1405],
    ])('maps %s to Jalali year %i', (isoDate, expectedYear) => {
        expect((0, jalali_1.gregorianToJalaliYear)(new Date(`${isoDate}T12:00:00Z`))).toBe(expectedYear);
    });
    it('produces a different year for two dates on opposite sides of Nowruz', () => {
        const beforeNowruz = (0, jalali_1.gregorianToJalaliYear)(new Date('2025-03-01T12:00:00Z'));
        const afterNowruz = (0, jalali_1.gregorianToJalaliYear)(new Date('2025-04-01T12:00:00Z'));
        expect(afterNowruz).toBe(beforeNowruz + 1);
    });
});
//# sourceMappingURL=jalali.spec.js.map