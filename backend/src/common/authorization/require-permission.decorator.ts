import { SetMetadata } from '@nestjs/common';
import { Permission } from './permissions';

export const PERMISSION_KEY = 'required_permission';
export const RequirePermission = (permission: Permission) =>
  SetMetadata(PERMISSION_KEY, permission);
