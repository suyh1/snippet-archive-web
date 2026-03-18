import acidRushTheme from './presets/acid-rush.theme.json'
import auroraNightTheme from './presets/aurora-night.theme.json'
import biomeLightTheme from './presets/biome-light.theme.json'
import brutalSignalTheme from './presets/brutal-signal.theme.json'
import cobaltFluxTheme from './presets/cobalt-flux.theme.json'
import decoCircuitTheme from './presets/deco-circuit.theme.json'
import editorialNoirTheme from './presets/editorial-noir.theme.json'
import forestGlassTheme from './presets/forest-glass.theme.json'
import graphiteProTheme from './presets/graphite-pro.theme.json'
import inkWashZenTheme from './presets/ink-wash-zen.theme.json'
import lavaForgeTheme from './presets/lava-forge.theme.json'
import monoMinimalTheme from './presets/mono-minimal.theme.json'
import nordicFogTheme from './presets/nordic-fog.theme.json'
import paperInkTheme from './presets/paper-ink.theme.json'
import sunsetUiTheme from './presets/sunset-ui.theme.json'
import tokyoNeonTheme from './presets/tokyo-neon.theme.json'
import glassGradientTheme from './glass-gradient.theme.json'
import { cloneTheme, type UiThemeFile } from './theme-schema'

const builtinThemesRaw = [
  glassGradientTheme,
  acidRushTheme,
  editorialNoirTheme,
  brutalSignalTheme,
  biomeLightTheme,
  decoCircuitTheme,
  cobaltFluxTheme,
  lavaForgeTheme,
  inkWashZenTheme,
  nordicFogTheme,
  graphiteProTheme,
  tokyoNeonTheme,
  paperInkTheme,
  forestGlassTheme,
  sunsetUiTheme,
  monoMinimalTheme,
  auroraNightTheme,
] as UiThemeFile[]

const builtinThemes = builtinThemesRaw.map((theme) => cloneTheme(theme))
const builtinThemeMap = new Map(builtinThemes.map((theme) => [theme.meta.id, theme]))

export type BuiltinUiThemeOption = {
  id: string
  name: string
  description?: string
}

export function getBuiltinUiThemes() {
  return builtinThemes.map((theme) => cloneTheme(theme))
}

export function getBuiltinUiThemeById(themeId: string) {
  const theme = builtinThemeMap.get(themeId)
  return theme ? cloneTheme(theme) : null
}

export function isBuiltinUiThemeId(themeId: string) {
  return builtinThemeMap.has(themeId)
}

export function getBuiltinUiThemeOptions(): BuiltinUiThemeOption[] {
  return builtinThemes.map((theme) => ({
    id: theme.meta.id,
    name: theme.meta.name,
    description: theme.meta.description,
  }))
}
