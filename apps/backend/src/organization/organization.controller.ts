import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'
import { CurrentUser } from '../common/auth/current-user.decorator'
import { RequiredAuthGuard } from '../common/auth/required-auth.guard'
import type { AuthUser } from '../common/auth/auth-user'
import { AddMemberDto } from './dto/add-member.dto'
import { CreateOrganizationDto } from './dto/create-organization.dto'
import { UpdateMemberRoleDto } from './dto/update-member-role.dto'
import { OrganizationService } from './organization.service'

@Controller('organizations')
@UseGuards(RequiredAuthGuard)
export class OrganizationController {
  constructor(
    @Inject(OrganizationService)
    private readonly organizationService: OrganizationService,
  ) {}

  @Get()
  async listOrganizations(@CurrentUser() currentUser: AuthUser | null) {
    const items = await this.organizationService.listOrganizations(currentUser!.id)
    return { data: { items } }
  }

  @Post()
  async createOrganization(
    @CurrentUser() currentUser: AuthUser | null,
    @Body() dto: CreateOrganizationDto,
  ) {
    const organization = await this.organizationService.createOrganization(
      currentUser!.id,
      dto.name,
      dto.slug,
    )

    return { data: organization }
  }

  @Delete(':organizationId')
  async deleteOrganization(
    @CurrentUser() currentUser: AuthUser | null,
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
  ) {
    const removed = await this.organizationService.deleteOrganization(
      organizationId,
      currentUser!.id,
    )

    return { data: removed }
  }

  @Get(':organizationId/members')
  async listMembers(
    @CurrentUser() currentUser: AuthUser | null,
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
  ) {
    const items = await this.organizationService.listMembers(
      organizationId,
      currentUser!.id,
    )

    return { data: { items } }
  }

  @Post(':organizationId/members')
  async addMember(
    @CurrentUser() currentUser: AuthUser | null,
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @Body() dto: AddMemberDto,
  ) {
    const member = await this.organizationService.addMember(
      organizationId,
      currentUser!.id,
      dto.email,
      dto.role,
    )

    return { data: member }
  }

  @Patch(':organizationId/members/:membershipId')
  async updateMemberRole(
    @CurrentUser() currentUser: AuthUser | null,
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @Param('membershipId', new ParseUUIDPipe()) membershipId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    const member = await this.organizationService.updateMemberRole(
      organizationId,
      membershipId,
      currentUser!.id,
      dto.role,
    )

    return { data: member }
  }

  @Delete(':organizationId/members/:membershipId')
  async removeMember(
    @CurrentUser() currentUser: AuthUser | null,
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @Param('membershipId', new ParseUUIDPipe()) membershipId: string,
  ) {
    const removed = await this.organizationService.removeMember(
      organizationId,
      membershipId,
      currentUser!.id,
    )

    return { data: removed }
  }
}
