import { performance } from 'node:perf_hooks'
import { PrismaClient } from '@prisma/client'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import request from 'supertest'
import { createTestApp } from '../test/helpers/test-app'

const BENCHMARK_SEED_SIZE = 1200
const BENCHMARK_RUNS = 5

function average(values: number[]) {
  if (values.length === 0) {
    return 0
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function median(values: number[]) {
  if (values.length === 0) {
    return 0
  }

  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

function percentile95(values: number[]) {
  if (values.length === 0) {
    return 0
  }

  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)
  return sorted[index] ?? 0
}

async function seedDataset(prisma: PrismaClient) {
  await prisma.workspaceFileRevision.deleteMany()
  await prisma.workspaceFile.deleteMany()
  await prisma.workspace.deleteMany()

  const workspace = await prisma.workspace.create({
    data: {
      title: 'Search Benchmark Workspace',
      description: '',
      tags: ['benchmark'],
      starred: false,
    },
  })

  const files = Array.from({ length: BENCHMARK_SEED_SIZE }, (_, index) => {
    const fileNo = index + 1
    const isTarget = fileNo % 3 === 0

    return {
      workspaceId: workspace.id,
      name: `snippet-${fileNo}.ts`,
      path: `/benchmark/snippet-${fileNo}.ts`,
      language: 'typescript',
      content: isTarget
        ? `export const alpha${fileNo} = () => 'alpha benchmark ${fileNo}'`
        : `export const beta${fileNo} = () => 'beta benchmark ${fileNo}'`,
      tags: isTarget ? ['alpha', 'benchmark'] : ['beta', 'benchmark'],
      starred: false,
      kind: 'file',
      order: fileNo,
    }
  })

  await prisma.workspaceFile.createMany({ data: files })
  return workspace.id
}

async function benchmarkSearch(app: NestFastifyApplication) {
  const runs: number[] = []

  await request(app.getHttpServer())
    .get('/api/search/snippets')
    .query({ keyword: 'alpha benchmark', page: '1', pageSize: '20' })
    .expect(200)

  for (let i = 0; i < BENCHMARK_RUNS; i += 1) {
    const startedAt = performance.now()
    const response = await request(app.getHttpServer())
      .get('/api/search/snippets')
      .query({ keyword: 'alpha benchmark', page: '1', pageSize: '20' })

    const elapsed = performance.now() - startedAt

    if (response.status !== 200) {
      throw new Error(`Unexpected search status: ${response.status}`)
    }

    runs.push(elapsed)
  }

  return runs
}

async function main() {
  const prisma = new PrismaClient()
  let app: NestFastifyApplication | null = null

  try {
    app = await createTestApp()
    await seedDataset(prisma)

    const runs = await benchmarkSearch(app)
    const avgMs = average(runs)
    const p50Ms = median(runs)
    const p95Ms = percentile95(runs)

    console.log(`seed_size=${BENCHMARK_SEED_SIZE}`)
    console.log(`runs_ms=${runs.map((ms) => ms.toFixed(2)).join(',')}`)
    console.log(`avg_ms=${avgMs.toFixed(2)}`)
    console.log(`p50_ms=${p50Ms.toFixed(2)}`)
    console.log(`p95_ms=${p95Ms.toFixed(2)}`)

    if (p95Ms >= 500) {
      throw new Error(`Search benchmark failed: p95 ${p95Ms.toFixed(2)}ms >= 500ms`)
    }

    console.log('result=PASS (<500ms)')
  } finally {
    if (app) {
      await app.close()
    }
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
