"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toSchoolSettingsView = toSchoolSettingsView;
function toSchoolSettingsView(settings) {
    return {
        schoolId: settings.schoolId,
        schoolName: settings.schoolName,
        logoUrl: settings.logoUrl,
        address: settings.address,
        phone: settings.phone,
        email: settings.email,
        website: settings.website,
        timezone: settings.timezone,
        language: settings.language,
        currency: settings.currency,
        weekStartsOn: settings.weekStartsOn,
        workingDays: settings.workingDays,
        passingScore: Number(settings.passingScore),
        attendanceLateMinutes: settings.attendanceLateMinutes,
        tuitionReminderDays: settings.tuitionReminderDays,
        smsEnabled: settings.smsEnabled,
        emailEnabled: settings.emailEnabled,
        primaryColor: settings.primaryColor,
        secondaryColor: settings.secondaryColor,
        createdAt: settings.createdAt,
        updatedAt: settings.updatedAt,
    };
}
//# sourceMappingURL=school-settings-view.dto.js.map