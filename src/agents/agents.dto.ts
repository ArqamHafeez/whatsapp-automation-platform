import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export const AGENT_TYPES = ['relevance', 'clean', 'route', 'image_edit', 'custom'] as const;
export type AgentTypeDto = (typeof AGENT_TYPES)[number];

export class CreateAgentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsIn(AGENT_TYPES)
  type!: AgentTypeDto;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  systemPrompt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  userPromptTemplate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  model?: string;

  @IsOptional()
  @IsObject()
  structuredConfig?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(16000)
  advancedPromptOverride?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateAgentDto {
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
  @IsIn(AGENT_TYPES)
  type?: AgentTypeDto;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  systemPrompt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  userPromptTemplate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  model?: string;

  @IsOptional()
  @IsObject()
  structuredConfig?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(16000)
  advancedPromptOverride?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
