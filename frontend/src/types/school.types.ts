// School domain types.
// Mirrors the actual backend model 1:1 (see modules/schools/* entity and
// dto).

export interface School {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
}
