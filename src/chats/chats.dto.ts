import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateChatDto {
  @IsOptional()
  @IsBoolean()
  isSource?: boolean;

  @IsOptional()
  @IsBoolean()
  isDestination?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}