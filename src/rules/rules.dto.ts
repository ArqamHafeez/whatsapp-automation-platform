import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const REVIEW_MODES = ['off', 'on_escalation', 'always'] as const;
export type ReviewMode = (typeof REVIEW_MODES)[number];

export class CreateRuleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsUUID('4')
  connectionId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  sourceChatIds!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  destinationChatIds!: string[];

  @IsOptional()
  @IsIn(REVIEW_MODES)
  reviewMode?: ReviewMode;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10080)
  reviewTimeoutMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  pipelineAgentIds?: string[];

  @IsOptional()
  @IsBoolean()
  pipelineFailOpen?: boolean;
}

export class UpdateRuleDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsUUID('4')
  connectionId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  sourceChatIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  destinationChatIds?: string[];

  @IsOptional()
  @IsIn(REVIEW_MODES)
  reviewMode?: ReviewMode;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10080)
  reviewTimeoutMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  pipelineAgentIds?: string[];

  @IsOptional()
  @IsBoolean()
  pipelineFailOpen?: boolean;
}
