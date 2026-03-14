import { IsInt, IsOptional, IsString, Min } from 'class-validator'

export class MoveWorkspaceFileDto {
  @IsString()
  targetPath!: string

  @IsOptional()
  @IsInt()
  @Min(1)
  targetOrder?: number
}
