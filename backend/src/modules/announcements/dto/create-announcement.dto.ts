import { IsString, IsNotEmpty, MaxLength, IsEnum } from 'class-validator';
import { AnnouncementTargetType } from '../entities/announcement.entity';

export class CreateAnnouncementDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message: string;

  @IsEnum(AnnouncementTargetType)
  targetType: AnnouncementTargetType;
}
