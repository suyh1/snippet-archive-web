import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator'

export class UpdateWorkspaceFileDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  path?: string

  @IsOptional()
  @IsString()
  language?: string

  @IsOptional()
  @IsString()
  content?: string

  @IsOptional()
  @IsString()
  kind?: string

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  tags?: string[]

  @IsOptional()
  @IsBoolean()
  starred?: boolean
}
