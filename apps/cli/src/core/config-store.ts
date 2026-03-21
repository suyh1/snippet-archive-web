import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'

export type CliLocalConfig = {
  accessToken?: string
  apiBaseUrl?: string
}

const DEFAULT_CONFIG_PATH = join(homedir(), '.snippet-archive-cli', 'config.json')

export async function readCliLocalConfig(): Promise<CliLocalConfig> {
  try {
    const content = await readFile(DEFAULT_CONFIG_PATH, 'utf8')
    const raw = JSON.parse(content) as Record<string, unknown>

    return {
      accessToken: typeof raw.accessToken === 'string' ? raw.accessToken : undefined,
      apiBaseUrl: typeof raw.apiBaseUrl === 'string' ? raw.apiBaseUrl : undefined,
    }
  } catch {
    return {}
  }
}

export async function writeCliLocalConfig(config: CliLocalConfig) {
  await mkdir(dirname(DEFAULT_CONFIG_PATH), { recursive: true })
  await writeFile(DEFAULT_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8')
}

