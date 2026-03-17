import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  ArrayMaxSize,
  IsUUID,
} from 'class-validator'

export class CreateWorkspaceDto {
  @IsString()
  title!: string

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

  @IsOptional()
  @IsUUID()
  organizationId?: string
}
