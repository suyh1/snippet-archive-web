import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { OrganizationRole } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { PermissionService } from '../permission/permission.service'
import { AuditService } from '../audit/audit.service'

@Injectable()
export class OrganizationService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(PermissionService)
    private readonly permissionService: PermissionService,
    @Inject(AuditService)
    private readonly auditService: AuditService,
  ) {}

  async listOrganizations(currentUserId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: {
        userId: currentUserId,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            ownerId: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: {
        organization: {
          updatedAt: 'desc',
        },
      },
    })

    return memberships.map((membership) => {
      return {
        id: membership.organization.id,
        name: membership.organization.name,
        slug: membership.organization.slug,
        ownerId: membership.organization.ownerId,
        currentUserRole: membership.role,
        createdAt: membership.organization.createdAt,
        updatedAt: membership.organization.updatedAt,
      }
    })
  }

  async createOrganization(currentUserId: string, name: string, slug: string) {
    const normalizedSlug = slug.trim().toLowerCase()

    const existing = await this.prisma.organization.findUnique({
      where: { slug: normalizedSlug },
      select: { id: true },
    })

    if (existing) {
      throw new ConflictException('Organization slug already exists')
    }

    const created = await this.prisma.organization.create({
      data: {
        name: name.trim(),
        slug: normalizedSlug,
        ownerId: currentUserId,
        memberships: {
          create: {
            userId: currentUserId,
            role: 'OWNER',
          },
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    await this.auditService.record({
      organizationId: created.id,
      actorId: currentUserId,
      action: 'ORGANIZATION_CREATED',
      resourceType: 'organization',
      resourceId: created.id,
      payload: {
        slug: created.slug,
      },
    })

    return {
      ...created,
      currentUserRole: 'OWNER' as const,
    }
  }

  async listMembers(organizationId: string, currentUserId: string) {
    await this.permissionService.requireMembership(organizationId, currentUserId, 'VIEWER')

    const members = await this.prisma.membership.findMany({
      where: { organizationId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: [
        { role: 'asc' },
        { createdAt: 'asc' },
      ],
    })

    return members.map((item) => {
      return {
        id: item.id,
        organizationId: item.organizationId,
        userId: item.userId,
        role: item.role,
        createdAt: item.createdAt,
        user: item.user,
      }
    })
  }

  async addMember(
    organizationId: string,
    currentUserId: string,
    email: string,
    role: OrganizationRole,
  ) {
    await this.permissionService.requireMembership(organizationId, currentUserId, 'OWNER')

    const targetUser = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, email: true, name: true },
    })

    if (!targetUser) {
      throw new NotFoundException('User not found')
    }

    const membership = await this.prisma.membership.upsert({
      where: {
        organizationId_userId: {
          organizationId,
          userId: targetUser.id,
        },
      },
      update: {
        role,
      },
      create: {
        organizationId,
        userId: targetUser.id,
        role,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    })

    await this.auditService.record({
      organizationId,
      actorId: currentUserId,
      action: 'ORGANIZATION_MEMBER_UPSERTED',
      resourceType: 'membership',
      resourceId: membership.id,
      payload: {
        userId: membership.userId,
        role: membership.role,
      },
    })

    return {
      id: membership.id,
      organizationId: membership.organizationId,
      userId: membership.userId,
      role: membership.role,
      createdAt: membership.createdAt,
      user: membership.user,
    }
  }

  async updateMemberRole(
    organizationId: string,
    membershipId: string,
    currentUserId: string,
    role: OrganizationRole,
  ) {
    const managerMembership = await this.permissionService.requireMembership(
      organizationId,
      currentUserId,
      'OWNER',
    )

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { ownerId: true },
    })

    if (!organization) {
      throw new NotFoundException('Organization not found')
    }

    const targetMembership = await this.prisma.membership.findFirst({
      where: {
        id: membershipId,
        organizationId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    })

    if (!targetMembership) {
      throw new NotFoundException('Membership not found')
    }

    if (targetMembership.userId === organization.ownerId && role !== 'OWNER') {
      throw new ConflictException('Organization owner must remain OWNER')
    }

    if (
      targetMembership.userId === managerMembership.userId &&
      targetMembership.role === 'OWNER' &&
      role !== 'OWNER'
    ) {
      throw new ConflictException('Cannot downgrade current owner role')
    }

    const updated = await this.prisma.membership.update({
      where: { id: membershipId },
      data: { role },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    })

    await this.auditService.record({
      organizationId,
      actorId: currentUserId,
      action: 'ORGANIZATION_MEMBER_ROLE_UPDATED',
      resourceType: 'membership',
      resourceId: updated.id,
      payload: {
        userId: updated.userId,
        role: updated.role,
      },
    })

    return {
      id: updated.id,
      organizationId: updated.organizationId,
      userId: updated.userId,
      role: updated.role,
      createdAt: updated.createdAt,
      user: updated.user,
    }
  }

  async removeMember(
    organizationId: string,
    membershipId: string,
    currentUserId: string,
  ) {
    await this.permissionService.requireMembership(organizationId, currentUserId, 'OWNER')

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { ownerId: true },
    })

    if (!organization) {
      throw new NotFoundException('Organization not found')
    }

    const targetMembership = await this.prisma.membership.findFirst({
      where: {
        id: membershipId,
        organizationId,
      },
    })

    if (!targetMembership) {
      throw new NotFoundException('Membership not found')
    }

    if (targetMembership.userId === organization.ownerId) {
      throw new ConflictException('Organization owner cannot be removed')
    }

    await this.prisma.membership.delete({
      where: { id: targetMembership.id },
    })

    await this.auditService.record({
      organizationId,
      actorId: currentUserId,
      action: 'ORGANIZATION_MEMBER_REMOVED',
      resourceType: 'membership',
      resourceId: targetMembership.id,
      payload: {
        userId: targetMembership.userId,
      },
    })

    return {
      id: targetMembership.id,
    }
  }
}
