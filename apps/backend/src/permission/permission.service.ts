import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import { OrganizationRole, type Workspace } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

const ROLE_LEVEL: Record<OrganizationRole, number> = {
  VIEWER: 1,
  EDITOR: 2,
  OWNER: 3,
}

@Injectable()
export class PermissionService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async listOrganizationIdsForUser(userId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      select: { organizationId: true },
    })

    return memberships.map((item) => item.organizationId)
  }

  async getMembership(organizationId: string, userId: string) {
    return this.prisma.membership.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    })
  }

  async requireMembership(
    organizationId: string,
    userId: string | null | undefined,
    minRole: OrganizationRole,
  ) {
    if (!userId) {
      throw new UnauthorizedException('Authentication required')
    }

    const membership = await this.getMembership(organizationId, userId)
    if (!membership) {
      throw new ForbiddenException('No access to this organization')
    }

    if (!this.hasRoleAtLeast(membership.role, minRole)) {
      throw new ForbiddenException('Insufficient permissions')
    }

    return membership
  }

  async requireWorkspaceRole(
    workspaceId: string,
    userId: string | null | undefined,
    minRole: OrganizationRole,
  ) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    })

    if (!workspace) {
      throw new NotFoundException('Workspace not found')
    }

    if (!workspace.organizationId) {
      return {
        workspace,
        membership: null,
      }
    }

    const membership = await this.requireMembership(
      workspace.organizationId,
      userId,
      minRole,
    )

    return {
      workspace,
      membership,
    }
  }

  async ensureWorkspaceReadable(workspace: Workspace, userId: string | null | undefined) {
    if (!workspace.organizationId) {
      return null
    }

    return this.requireMembership(workspace.organizationId, userId, 'VIEWER')
  }

  async ensureWorkspaceWritable(workspace: Workspace, userId: string | null | undefined) {
    if (!workspace.organizationId) {
      return null
    }

    return this.requireMembership(workspace.organizationId, userId, 'EDITOR')
  }

  async ensureWorkspaceManageable(workspace: Workspace, userId: string | null | undefined) {
    if (!workspace.organizationId) {
      return null
    }

    return this.requireMembership(workspace.organizationId, userId, 'OWNER')
  }

  hasRoleAtLeast(role: OrganizationRole, minRole: OrganizationRole) {
    return ROLE_LEVEL[role] >= ROLE_LEVEL[minRole]
  }
}
