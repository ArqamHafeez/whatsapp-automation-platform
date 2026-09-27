<<<<<<< HEAD
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';
=======
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a

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
<<<<<<< HEAD

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
=======
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
}