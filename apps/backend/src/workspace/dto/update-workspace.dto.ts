import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  ArrayMaxSize,
} from 'class-validator'

export class UpdateWorkspaceDto {
  @IsOptional()
  @IsString()
  title?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  tags?: string[]

  @IsOptional()
  @IsBoolean()
  starred?: boolean
}
