import { PrismaClient } from '@prisma/client'
import {
  buildM2MetricsReport,
  createRollingWindow,
  M2_WRITE_ACTION_ROLE_REQUIREMENTS,
  type M2MetricsRawData,
} from '../../src/metrics/m2-metrics'

type CliOptions = {
  asOf: Date
  windowDays: number
}

function parseCliArgs(argv: string[]): CliOptions {
  let asOf = new Date()
  let windowDays = 30

  for (const arg of argv) {
    if (arg.startsWith('--as-of=')) {
      const raw = arg.slice('--as-of='.length)
      const parsed = new Date(raw)
      if (Number.isNaN(parsed.getTime())) {
        throw new Error(`Invalid --as-of value: ${raw}`)
      }
      asOf = parsed
      continue
    }

    if (arg.startsWith('--window-days=')) {
      const raw = Number.parseInt(arg.slice('--window-days='.length), 10)
      if (!Number.isFinite(raw) || raw < 1) {
        throw new Error('Invalid --window-days value, expected integer >= 1')
      }
      windowDays = raw
      continue
    }
  }

  return {
    asOf,
    windowDays,
  }
}

async function loadRawData(
  prisma: PrismaClient,
  from: Date,
  to: Date,
): Promise<M2MetricsRawData> {
  const trackedActions = Object.keys(M2_WRITE_ACTION_ROLE_REQUIREMENTS)

  const [
    totalWorkspacesInWindow,
    teamWorkspacesInWindow,
    shareLinksCreatedInWindow,
    writeAuditLogsInWindow,
  ] = await prisma.$transaction([
    prisma.workspace.count({
      where: {
        createdAt: {
          gte: from,
          lte: to,
        },
      },
    }),
    prisma.workspace.count({
      where: {
        organizationId: { not: null },
        createdAt: {
          gte: from,
          lte: to,
        },
      },
    }),
    prisma.shareLink.count({
      where: {
        createdAt: {
          gte: from,
          lte: to,
        },
      },
    }),
    prisma.auditLog.findMany({
      where: {
        createdAt: {
          gte: from,
          lte: to,
        },
        action: {
          in: trackedActions,
        },
      },
      select: {
        id: true,
        organizationId: true,
        actorId: true,
        action: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
  ])

  const organizationIds = Array.from(
    new Set(writeAuditLogsInWindow.map((item) => item.organizationId)),
  )
  const actorIds = Array.from(
    new Set(
      writeAuditLogsInWindow
        .map((item) => item.actorId)
        .filter((item): item is string => Boolean(item)),
    ),
  )

  const membershipSnapshots =
    organizationIds.length > 0 && actorIds.length > 0
      ? await prisma.membership.findMany({
          where: {
            organizationId: { in: organizationIds },
            userId: { in: actorIds },
          },
          select: {
            organizationId: true,
            userId: true,
            role: true,
            updatedAt: true,
          },
        })
      : []

  return {
    totalWorkspacesInWindow,
    teamWorkspacesInWindow,
    shareLinksCreatedInWindow,
    writeAuditLogsInWindow,
    membershipSnapshots,
  }
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2))
  const window = createRollingWindow(options.asOf, options.windowDays)
  const prisma = new PrismaClient()

  try {
    const raw = await loadRawData(prisma, window.from, window.to)
    const report = buildM2MetricsReport(raw, window)

    console.log(JSON.stringify(report, null, 2))
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
