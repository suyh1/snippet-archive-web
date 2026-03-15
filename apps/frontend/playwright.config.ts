import { defineConfig } from '@playwright/test'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = resolve(__dirname, '../..')
const defaultDatabaseUrl = 'postgresql://snippet:snippet@localhost:54329/snippet_archive'

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  timeout: 120_000,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command:
        'npm run build --workspace @snippet-archive/backend && npm run start --workspace @snippet-archive/backend',
      cwd: repoRoot,
      url: 'http://127.0.0.1:3001/health',
      reuseExistingServer: true,
      timeout: 180_000,
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL ?? defaultDatabaseUrl,
        PORT: process.env.PORT ?? '3001',
      },
    },
    {
      command: 'npm run dev --workspace @snippet-archive/frontend -- --host 127.0.0.1 --port 4173',
      cwd: repoRoot,
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
})
