// Next Imports
import { Inter, Noto_Sans_Arabic } from 'next/font/google'

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

// X-Station Design Language: Inter font for Latin, Noto Sans Arabic for Arabic
const inter = Inter({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'] })
const notoSansArabic = Noto_Sans_Arabic({ subsets: ['arabic'], weight: ['300', '400', '500', '600', '700'] })

const theme = (settings: Settings, mode: SystemMode, direction: Theme['direction']): Theme => {
  // Use Arabic font for RTL direction, Inter for LTR
  const fontFamily = direction === 'rtl' 
    ? `${notoSansArabic.style.fontFamily}, ${inter.style.fontFamily}`
    : inter.style.fontFamily

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
    typography: typography(fontFamily),
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
