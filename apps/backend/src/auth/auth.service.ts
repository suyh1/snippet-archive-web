import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type { AuthUser } from '../common/auth/auth-user'
import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(nodeScrypt)
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7

type AuthResult = {
  accessToken: string
  expiresAt: string
  user: AuthUser
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async register(email: string, name: string, password: string): Promise<AuthResult> {
    const normalizedEmail = this.normalizeEmail(email)

    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    })

    if (existing) {
      throw new ConflictException('Email already exists')
    }

    const passwordHash = await this.hashPassword(password)
    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        name: name.trim(),
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    })

    const session = await this.createSession(user.id)

    return {
      accessToken: session.token,
      expiresAt: session.expiresAt.toISOString(),
      user,
    }
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const normalizedEmail = this.normalizeEmail(email)

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        name: true,
        passwordHash: true,
      },
    })

    if (!user) {
      throw new UnauthorizedException('Invalid email or password')
    }

    const passwordMatched = await this.verifyPassword(password, user.passwordHash)
    if (!passwordMatched) {
      throw new UnauthorizedException('Invalid email or password')
    }

    const session = await this.createSession(user.id)

    return {
      accessToken: session.token,
      expiresAt: session.expiresAt.toISOString(),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    }
  }

  async resolveUserByAccessToken(token: string): Promise<AuthUser | null> {
    const now = new Date()
    const session = await this.prisma.session.findFirst({
      where: {
        token,
        revokedAt: null,
        expiresAt: {
          gt: now,
        },
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

    return session?.user ?? null
  }

  async logout(token: string) {
    await this.prisma.session.updateMany({
      where: {
        token,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    })
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase()
  }

  private async createSession(userId: string) {
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS)

    return this.prisma.session.create({
      data: {
        userId,
        token: randomBytes(32).toString('hex'),
        expiresAt,
      },
      select: {
        token: true,
        expiresAt: true,
      },
    })
  }

  private async hashPassword(password: string) {
    const salt = randomBytes(16).toString('hex')
    const derivedKey = (await scrypt(password, salt, 64)) as Buffer
    return `${salt}:${derivedKey.toString('hex')}`
  }

  private async verifyPassword(password: string, passwordHash: string) {
    const [salt, hash] = passwordHash.split(':')
    if (!salt || !hash) {
      return false
    }

    const derivedKey = (await scrypt(password, salt, 64)) as Buffer
    const hashBuffer = Buffer.from(hash, 'hex')

    if (derivedKey.length !== hashBuffer.length) {
      return false
    }

    return timingSafeEqual(derivedKey, hashBuffer)
  }
}
