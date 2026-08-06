import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class SimulateRuleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sender?: string;
}
