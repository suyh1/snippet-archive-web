import { OrganizationRole } from '@prisma/client'
import { IsEmail, IsEnum } from 'class-validator'

export class AddMemberDto {
  @IsEmail()
  email!: string

  @IsEnum(OrganizationRole)
  role!: OrganizationRole
}
