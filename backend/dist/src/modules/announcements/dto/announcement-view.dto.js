"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toAnnouncementView = toAnnouncementView;
exports.toRecipientAnnouncementView = toRecipientAnnouncementView;
function toAnnouncementView(announcement) {
    return {
        id: announcement.id,
        title: announcement.title,
        message: announcement.message,
        targetType: announcement.targetType,
        createdById: announcement.createdById,
        createdAt: announcement.createdAt,
    };
}
function toRecipientAnnouncementView(announcement) {
    return {
        id: announcement.id,
        title: announcement.title,
        message: announcement.message,
        targetType: announcement.targetType,
        createdAt: announcement.createdAt,
    };
}
//# sourceMappingURL=announcement-view.dto.js.map