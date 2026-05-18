// MUI Imports
import type { Theme } from '@mui/material/styles'

// Type Imports
import type { Skin } from '@core/types'

/**
 * X-Station Design Language Color System
 * 
 * Primary: #5b0e00 — actions only
 * Black: #000000
 * White: #FFFFFF
 * 
 * Grays (Hierarchy Only):
 * #111111 — dark surfaces
 * #222222 — borders / dividers (dark)
 * #666666 — secondary text
 * #AAAAAA — tertiary / placeholders
 * #E5E5E5 — borders (light)
 * #F5F5F5 — input & surface backgrounds
 * 
 * Dark mode is pure black, not gray
 */

const colorSchemes = (skin: Skin): Theme['colorSchemes'] => {
  return {
    light: {
      palette: {
        primary: {
          main: '#5b0e00',
          light: '#7a1a0a',
          dark: '#3d0900',
          lighterOpacity: 'rgb(var(--mui-palette-primary-mainChannel) / 0.08)',
          lightOpacity: 'rgb(var(--mui-palette-primary-mainChannel) / 0.16)',
          mainOpacity: 'rgb(var(--mui-palette-primary-mainChannel) / 0.24)',
          darkOpacity: 'rgb(var(--mui-palette-primary-mainChannel) / 0.32)',
          darkerOpacity: 'rgb(var(--mui-palette-primary-mainChannel) / 0.38)'
        },
        secondary: {
          main: '#666666',
          light: '#AAAAAA',
          dark: '#222222',
          contrastText: '#FFFFFF',
          lighterOpacity: 'rgb(var(--mui-palette-secondary-mainChannel) / 0.08)',
          lightOpacity: 'rgb(var(--mui-palette-secondary-mainChannel) / 0.16)',
          mainOpacity: 'rgb(var(--mui-palette-secondary-mainChannel) / 0.24)',
          darkOpacity: 'rgb(var(--mui-palette-secondary-mainChannel) / 0.32)',
          darkerOpacity: 'rgb(var(--mui-palette-secondary-mainChannel) / 0.38)'
        },
        error: {
          main: '#DC2626',
          light: '#EF4444',
          dark: '#B91C1C',
          contrastText: '#FFFFFF',
          lighterOpacity: 'rgb(var(--mui-palette-error-mainChannel) / 0.08)',
          lightOpacity: 'rgb(var(--mui-palette-error-mainChannel) / 0.16)',
          mainOpacity: 'rgb(var(--mui-palette-error-mainChannel) / 0.24)',
          darkOpacity: 'rgb(var(--mui-palette-error-mainChannel) / 0.32)',
          darkerOpacity: 'rgb(var(--mui-palette-error-mainChannel) / 0.38)'
        },
        warning: {
          main: '#D97706',
          light: '#F59E0B',
          dark: '#B45309',
          contrastText: '#FFFFFF',
          lighterOpacity: 'rgb(var(--mui-palette-warning-mainChannel) / 0.08)',
          lightOpacity: 'rgb(var(--mui-palette-warning-mainChannel) / 0.16)',
          mainOpacity: 'rgb(var(--mui-palette-warning-mainChannel) / 0.24)',
          darkOpacity: 'rgb(var(--mui-palette-warning-mainChannel) / 0.32)',
          darkerOpacity: 'rgb(var(--mui-palette-warning-mainChannel) / 0.38)'
        },
        info: {
          main: '#0284C7',
          light: '#0EA5E9',
          dark: '#0369A1',
          contrastText: '#FFFFFF',
          lighterOpacity: 'rgb(var(--mui-palette-info-mainChannel) / 0.08)',
          lightOpacity: 'rgb(var(--mui-palette-info-mainChannel) / 0.16)',
          mainOpacity: 'rgb(var(--mui-palette-info-mainChannel) / 0.24)',
          darkOpacity: 'rgb(var(--mui-palette-info-mainChannel) / 0.32)',
          darkerOpacity: 'rgb(var(--mui-palette-info-mainChannel) / 0.38)'
        },
        success: {
          main: '#16A34A',
          light: '#22C55E',
          dark: '#15803D',
          contrastText: '#FFFFFF',
          lighterOpacity: 'rgb(var(--mui-palette-success-mainChannel) / 0.08)',
          lightOpacity: 'rgb(var(--mui-palette-success-mainChannel) / 0.16)',
          mainOpacity: 'rgb(var(--mui-palette-success-mainChannel) / 0.24)',
          darkOpacity: 'rgb(var(--mui-palette-success-mainChannel) / 0.32)',
          darkerOpacity: 'rgb(var(--mui-palette-success-mainChannel) / 0.38)'
        },
        text: {
          primary: '#000000',
          secondary: '#666666',
          disabled: '#AAAAAA',
          primaryChannel: '0 0 0',
          secondaryChannel: '102 102 102'
        },
        divider: '#E5E5E5',
        dividerChannel: '229 229 229',
        background: {
          default: skin === 'bordered' ? '#FFFFFF' : '#F5F5F5',
          paper: '#FFFFFF',
          paperChannel: '255 255 255'
        },
        action: {
          active: 'rgba(0, 0, 0, 0.6)',
          hover: 'rgba(0, 0, 0, 0.04)',
          selected: 'rgba(0, 0, 0, 0.08)',
          disabled: 'rgba(0, 0, 0, 0.3)',
          disabledBackground: 'rgba(0, 0, 0, 0.12)',
          focus: 'rgba(0, 0, 0, 0.12)',
          focusOpacity: 0.12,
          activeChannel: '0 0 0',
          selectedChannel: '0 0 0'
        },
        Alert: {
          errorColor: 'var(--mui-palette-error-main)',
          warningColor: 'var(--mui-palette-warning-main)',
          infoColor: 'var(--mui-palette-info-main)',
          successColor: 'var(--mui-palette-success-main)',
          errorStandardBg: 'var(--mui-palette-error-lightOpacity)',
          warningStandardBg: 'var(--mui-palette-warning-lightOpacity)',
          infoStandardBg: 'var(--mui-palette-info-lightOpacity)',
          successStandardBg: 'var(--mui-palette-success-lightOpacity)',
          errorFilledColor: 'var(--mui-palette-error-contrastText)',
          warningFilledColor: 'var(--mui-palette-warning-contrastText)',
          infoFilledColor: 'var(--mui-palette-info-contrastText)',
          successFilledColor: 'var(--mui-palette-success-contrastText)',
          errorFilledBg: 'var(--mui-palette-error-main)',
          warningFilledBg: 'var(--mui-palette-warning-main)',
          infoFilledBg: 'var(--mui-palette-info-main)',
          successFilledBg: 'var(--mui-palette-success-main)'
        },
        Avatar: {
          defaultBg: '#F5F5F5'
        },
        Chip: {
          defaultBorder: '#E5E5E5'
        },
        FilledInput: {
          bg: '#F5F5F5',
          hoverBg: '#E5E5E5',
          disabledBg: '#F5F5F5'
        },
        SnackbarContent: {
          bg: '#111111',
          color: '#FFFFFF'
        },
        Switch: {
          defaultColor: 'var(--mui-palette-common-white)',
          defaultDisabledColor: 'var(--mui-palette-common-white)',
          primaryDisabledColor: 'var(--mui-palette-common-white)',
          secondaryDisabledColor: 'var(--mui-palette-common-white)',
          errorDisabledColor: 'var(--mui-palette-common-white)',
          warningDisabledColor: 'var(--mui-palette-common-white)',
          infoDisabledColor: 'var(--mui-palette-common-white)',
          successDisabledColor: 'var(--mui-palette-common-white)'
        },
        Tooltip: {
          bg: '#111111'
        },
        TableCell: {
          border: '#E5E5E5'
        },
        customColors: {
          bodyBg: '#F5F5F5',
          chatBg: '#F5F5F5',
          greyLightBg: '#F5F5F5',
          inputBorder: '#E5E5E5',
          tableHeaderBg: '#FFFFFF',
          tooltipText: '#FFFFFF',
          trackBg: '#E5E5E5'
        }
      }
    },
    dark: {
      // X-Station Design Language: Dark mode is pure black, not gray
      palette: {
        primary: {
          main: '#5b0e00',
          light: '#7a1a0a',
          dark: '#3d0900',
          lighterOpacity: 'rgb(var(--mui-palette-primary-mainChannel) / 0.08)',
          lightOpacity: 'rgb(var(--mui-palette-primary-mainChannel) / 0.16)',
          mainOpacity: 'rgb(var(--mui-palette-primary-mainChannel) / 0.24)',
          darkOpacity: 'rgb(var(--mui-palette-primary-mainChannel) / 0.32)',
          darkerOpacity: 'rgb(var(--mui-palette-primary-mainChannel) / 0.38)'
        },
        secondary: {
          main: '#AAAAAA',
          light: '#E5E5E5',
          dark: '#666666',
          contrastText: '#000000',
          lighterOpacity: 'rgb(var(--mui-palette-secondary-mainChannel) / 0.08)',
          lightOpacity: 'rgb(var(--mui-palette-secondary-mainChannel) / 0.16)',
          mainOpacity: 'rgb(var(--mui-palette-secondary-mainChannel) / 0.24)',
          darkOpacity: 'rgb(var(--mui-palette-secondary-mainChannel) / 0.32)',
          darkerOpacity: 'rgb(var(--mui-palette-secondary-mainChannel) / 0.38)'
        },
        error: {
          main: '#EF4444',
          light: '#F87171',
          dark: '#DC2626',
          contrastText: '#FFFFFF',
          lighterOpacity: 'rgb(var(--mui-palette-error-mainChannel) / 0.08)',
          lightOpacity: 'rgb(var(--mui-palette-error-mainChannel) / 0.16)',
          mainOpacity: 'rgb(var(--mui-palette-error-mainChannel) / 0.24)',
          darkOpacity: 'rgb(var(--mui-palette-error-mainChannel) / 0.32)',
          darkerOpacity: 'rgb(var(--mui-palette-error-mainChannel) / 0.38)'
        },
        warning: {
          main: '#F59E0B',
          light: '#FBBF24',
          dark: '#D97706',
          contrastText: '#000000',
          lighterOpacity: 'rgb(var(--mui-palette-warning-mainChannel) / 0.08)',
          lightOpacity: 'rgb(var(--mui-palette-warning-mainChannel) / 0.16)',
          mainOpacity: 'rgb(var(--mui-palette-warning-mainChannel) / 0.24)',
          darkOpacity: 'rgb(var(--mui-palette-warning-mainChannel) / 0.32)',
          darkerOpacity: 'rgb(var(--mui-palette-warning-mainChannel) / 0.38)'
        },
        info: {
          main: '#0EA5E9',
          light: '#38BDF8',
          dark: '#0284C7',
          contrastText: '#FFFFFF',
          lighterOpacity: 'rgb(var(--mui-palette-info-mainChannel) / 0.08)',
          lightOpacity: 'rgb(var(--mui-palette-info-mainChannel) / 0.16)',
          mainOpacity: 'rgb(var(--mui-palette-info-mainChannel) / 0.24)',
          darkOpacity: 'rgb(var(--mui-palette-info-mainChannel) / 0.32)',
          darkerOpacity: 'rgb(var(--mui-palette-info-mainChannel) / 0.38)'
        },
        success: {
          main: '#22C55E',
          light: '#4ADE80',
          dark: '#16A34A',
          contrastText: '#FFFFFF',
          lighterOpacity: 'rgb(var(--mui-palette-success-mainChannel) / 0.08)',
          lightOpacity: 'rgb(var(--mui-palette-success-mainChannel) / 0.16)',
          mainOpacity: 'rgb(var(--mui-palette-success-mainChannel) / 0.24)',
          darkOpacity: 'rgb(var(--mui-palette-success-mainChannel) / 0.32)',
          darkerOpacity: 'rgb(var(--mui-palette-success-mainChannel) / 0.38)'
        },
        text: {
          primary: '#FFFFFF',
          secondary: '#AAAAAA',
          disabled: '#666666',
          primaryChannel: '255 255 255',
          secondaryChannel: '170 170 170'
        },
        divider: '#222222',
        dividerChannel: '34 34 34',
        background: {
          // Pure black for dark mode
          default: skin === 'bordered' ? '#000000' : '#000000',
          paper: '#111111',
          paperChannel: '17 17 17'
        },
        action: {
          active: 'rgba(255, 255, 255, 0.6)',
          hover: 'rgba(255, 255, 255, 0.04)',
          selected: 'rgba(255, 255, 255, 0.08)',
          disabled: 'rgba(255, 255, 255, 0.3)',
          disabledBackground: 'rgba(255, 255, 255, 0.12)',
          focus: 'rgba(255, 255, 255, 0.12)',
          focusOpacity: 0.12,
          activeChannel: '255 255 255',
          selectedChannel: '255 255 255'
        },
        Alert: {
          errorColor: 'var(--mui-palette-error-main)',
          warningColor: 'var(--mui-palette-warning-main)',
          infoColor: 'var(--mui-palette-info-main)',
          successColor: 'var(--mui-palette-success-main)',
          errorStandardBg: 'var(--mui-palette-error-lightOpacity)',
          warningStandardBg: 'var(--mui-palette-warning-lightOpacity)',
          infoStandardBg: 'var(--mui-palette-info-lightOpacity)',
          successStandardBg: 'var(--mui-palette-success-lightOpacity)',
          errorFilledColor: 'var(--mui-palette-error-contrastText)',
          warningFilledColor: 'var(--mui-palette-warning-contrastText)',
          infoFilledColor: 'var(--mui-palette-info-contrastText)',
          successFilledColor: 'var(--mui-palette-success-contrastText)',
          errorFilledBg: 'var(--mui-palette-error-main)',
          warningFilledBg: 'var(--mui-palette-warning-main)',
          infoFilledBg: 'var(--mui-palette-info-main)',
          successFilledBg: 'var(--mui-palette-success-main)'
        },
        Avatar: {
          defaultBg: '#222222'
        },
        Chip: {
          defaultBorder: '#222222'
        },
        FilledInput: {
          bg: '#111111',
          hoverBg: '#222222',
          disabledBg: '#111111'
        },
        SnackbarContent: {
          bg: '#FFFFFF',
          color: '#000000'
        },
        Switch: {
          defaultColor: 'var(--mui-palette-common-white)',
          defaultDisabledColor: 'var(--mui-palette-common-white)',
          primaryDisabledColor: 'var(--mui-palette-common-white)',
          secondaryDisabledColor: 'var(--mui-palette-common-white)',
          errorDisabledColor: 'var(--mui-palette-common-white)',
          warningDisabledColor: 'var(--mui-palette-common-white)',
          infoDisabledColor: 'var(--mui-palette-common-white)',
          successDisabledColor: 'var(--mui-palette-common-white)'
        },
        Tooltip: {
          bg: '#FFFFFF'
        },
        TableCell: {
          border: '#222222'
        },
        customColors: {
          bodyBg: '#000000',
          chatBg: '#000000',
          greyLightBg: '#111111',
          inputBorder: '#222222',
          tableHeaderBg: '#111111',
          tooltipText: '#000000',
          trackBg: '#222222'
        }
      }
    }
  } as Theme['colorSchemes']
}

export default colorSchemes
