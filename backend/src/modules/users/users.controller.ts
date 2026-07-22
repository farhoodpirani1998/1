import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Post,
  Delete,
  HttpCode,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { avatarFileValidationPipe, avatarMulterOptions } from '../../common/storage/avatar-upload.options';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin')
@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles('super_admin')
  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.usersService.findAll(query);
  }

  // Replaces the old { isActive }-only setActive endpoint — same route,
  // now also accepts fullName/phone (see UpdateUserDto). Still handles
  // the plain activate/deactivate toggle, since UpdateUserDto's fields
  // are all optional.
  @Roles('super_admin')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @ApiOperation({ summary: "Reset another user's password (super_admin only)" })
  @Roles('super_admin')
  @Patch(':id/reset-password')
  resetPassword(@Param('id') id: string, @Body() dto: ResetPasswordDto) {
    return this.usersService.resetPassword(id, dto.newPassword);
  }
}

// Sprint P1 — Universal Avatar System.
//
// Kept as its own controller (same "one resource, split by access
// scope" shape as StudentDocumentsController/DocumentsController in
// student-documents.controller.ts) rather than added to UsersController
// above: that controller is class-level @Roles('super_admin') because
// every route on it edits *another* user. These routes edit the
// caller's own row and must be open to every authenticated role
// (school_admin, accountant, staff, parent, teacher, founder, student
// alike), so they get only @UseGuards(JwtAuthGuard) — no RolesGuard, no
// @Roles() — the same self-service shape AuthController already uses
// for POST /auth/change-password.
@UseGuards(JwtAuthGuard)
@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller('users/me')
export class UsersMeController {
  constructor(private readonly usersService: UsersService) {}

  // Sprint A3 — My Profile. The caller's own safe user fields plus their
  // school's name (only schoolId lives on the token/user row itself).
  @Get()
  getMyProfile(@CurrentUser('id') userId: string) {
    return this.usersService.findMyProfile(userId);
  }

  // Sprint A3 — My Profile. fullName/phone only (see UpdateProfileDto) —
  // username/role/schoolId are never accepted, same as every other
  // update path in this module.
  @Patch()
  updateMyProfile(@Body() dto: UpdateProfileDto, @CurrentUser('id') userId: string) {
    return this.usersService.updateProfile(userId, dto);
  }

  // multipart/form-data, field name "avatar". avatarMulterOptions()
  // handles storage + a coarse size/type backstop; avatarFileValidationPipe()
  // is the authoritative size/type check (see common/storage/avatar-upload.options.ts
  // for why both exist).
  @ApiOperation({ summary: "Upload/replace the current user's avatar image" })
  @Post('avatar')
  @UseInterceptors(FileInterceptor('avatar', avatarMulterOptions()))
  uploadAvatar(
    @UploadedFile(avatarFileValidationPipe()) file: Express.Multer.File,
    @CurrentUser('id') userId: string,
  ) {
    return this.usersService.updateAvatar(userId, file);
  }

  // Reverts to the initial-letter placeholder — no body, same
  // idempotent-delete shape as DELETE /documents/:id.
  @Delete('avatar')
  @HttpCode(200)
  removeAvatar(@CurrentUser('id') userId: string) {
    return this.usersService.removeAvatar(userId);
  }
}
