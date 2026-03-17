import { ShareLinkPermission, ShareLinkVisibility } from '@prisma/client'
import { IsDateString, IsEnum, IsOptional } from 'class-validator'

export class CreateShareLinkDto {
  @IsEnum(ShareLinkVisibility)
  visibility!: ShareLinkVisibility

  @IsOptional()
  @IsEnum(ShareLinkPermission)
  permission?: ShareLinkPermission

  @IsOptional()
  @IsDateString()
  expiresAt?: string
}
