import { IsString, Matches, MaxLength, MinLength } from 'class-validator'

export class CreateOrganizationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string

  @IsString()
  @MinLength(3)
  @MaxLength(64)
  @Matches(/^[a-z0-9-]+$/)
  slug!: string
}
