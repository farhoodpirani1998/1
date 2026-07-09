import { IsBoolean } from 'class-validator';

// Replaces the previous bare @Body('isActive') param, which accepted
// whatever shape/type the client sent with no validation. With
// ValidationPipe's whitelist+forbidNonWhitelisted (see main.ts), any
// request body that isn't exactly `{ isActive: boolean }` is now rejected
// instead of silently coerced or ignored.
export class UpdateUserStatusDto {
  @IsBoolean()
  isActive: boolean;
}
