import { api } from '../lib/api';
import type { SchoolSettings } from '../types/schoolSettings.types';

export function getSchoolSettings() {
  return api.get<SchoolSettings>('/settings');
}

// Every field on the backend's UpdateSchoolSettingsDto is optional and
// merged onto the existing row (omitted fields are left unchanged) — so
// callers here only ever send the one field they're actually changing
// (logoUrl today).
export interface UpdateSchoolSettingsInput {
  logoUrl?: string | null;
}
export function updateSchoolSettings(dto: UpdateSchoolSettingsInput) {
  return api.put<SchoolSettings>('/settings', dto);
}
