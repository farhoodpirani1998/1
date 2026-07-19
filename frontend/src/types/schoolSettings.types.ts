// Mirrors SchoolSettingsView on the backend (GET/PUT /settings,
// school_admin-only). Only logoUrl is surfaced in the UI today (the
// school-branding panel on SettingsPage) — the rest of the fields are
// typed here so future panels don't have to redefine this shape, but
// nothing else in the app reads or writes them yet.
export interface SchoolSettings {
  schoolId: string;
  schoolName: string;
  logoUrl: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
}
