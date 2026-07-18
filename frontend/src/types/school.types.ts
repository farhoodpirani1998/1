// School domain types.
// Mirrors the actual backend model 1:1 (see modules/schools/* entity and
// dto).

export interface School {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
  // Only present on GET /schools (list) responses — SchoolsService.findAll
  // computes these via an aggregate query. Not returned by
  // findOne/create/update, hence optional.
  studentCount?: number;
  userCount?: number;
}
