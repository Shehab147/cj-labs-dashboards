// Next Imports
import { Inter } from 'next/font/google'

// MUI Imports
import type { Theme } from '@mui/material/styles'

// Type Imports
import type { Settings } from '@core/contexts/settingsContext'
import type { SystemMode, Skin } from '@core/types'

// Theme Options Imports
import overrides from './overrides'
import colorSchemes from './colorSchemes'
import spacing from './spacing'
import shadows from './shadows'
import customShadows from './customShadows'
import typography from './typography'

// X-Station Design Language: Inter font
const inter = Inter({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'] })

const theme = (settings: Settings, mode: SystemMode, direction: Theme['direction']): Theme => {
  return {
    direction,
    components: overrides(settings.skin as Skin),
    colorSchemes: colorSchemes(settings.skin as Skin),
    ...spacing,
    shape: {
      // X-Station Design Language: Default radius 12px
      borderRadius: 12,
      customBorderRadius: {
        xs: 4,
        sm: 8,
        md: 12,
        lg: 12,
        xl: 12
      }
    },
    shadows: shadows(mode),
    typography: typography(inter.style.fontFamily),
    customShadows: customShadows(mode),
    // X-Station Design Language: Pure black for dark mode
    mainColorChannels: {
      light: '0 0 0',
      dark: '255 255 255',
      lightShadow: '0 0 0',
      darkShadow: '0 0 0'
    }
  } as Theme
}

export default theme
