import { IsInt, IsOptional, IsString, Min } from 'class-validator'

export class CreateWorkspaceFileDto {
  @IsString()
  name!: string

  @IsString()
  path!: string

  @IsString()
  language!: string

  @IsOptional()
  @IsString()
  content?: string

  @IsString()
  kind!: string

  @IsInt()
  @Min(0)
  order!: number
}
