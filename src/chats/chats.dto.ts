import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';

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

  /** Omit or set null to clear the hourly cap. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  @Max(10_000)
  @Type(() => Number)
  maxSendsPerHour?: number | null;

  /** Omit or set null to clear the daily cap. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  @Max(100_000)
  @Type(() => Number)
  maxSendsPerDay?: number | null;
}