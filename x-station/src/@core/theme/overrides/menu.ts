// MUI Imports
import type { Theme } from '@mui/material/styles'

// Type Imports
import type { Skin } from '@core/types'

/**
 * X-Station Design Language - Menu
 * Radius: 12px
 * Border > shadow
 */

const menu = (skin: Skin): Theme['components'] => ({
  MuiMenu: {
    defaultProps: {
      slotProps: {
        paper: {
          elevation: 0
        }
      }
    },
    styleOverrides: {
      paper: ({ theme }) => ({
        marginBlockStart: theme.spacing(0.5),
        // X-Station Design Language: No shadow, border only
        boxShadow: 'none',
        border: '1px solid var(--mui-palette-divider)',
        borderRadius: 12
      })
    }
  },
  MuiMenuItem: {
    styleOverrides: {
      root: ({ theme }) => ({
        paddingBlock: theme.spacing(2),
        gap: theme.spacing(2),
        color: 'var(--mui-palette-text-primary)',
        marginInline: theme.spacing(2),
        // X-Station Design Language: 12px radius
        borderRadius: 12,
        '& i, & svg': {
          fontSize: '1.375rem'
        },
        '& .MuiListItemIcon-root': {
          minInlineSize: 0
        },
        '&:not(:last-of-type)': {
          marginBlockEnd: theme.spacing(0.5)
        },
        '&.Mui-selected': {
          backgroundColor: 'var(--mui-palette-primary-lightOpacity)',
          color: 'var(--mui-palette-primary-main)',
          '& .MuiListItemIcon-root': {
            color: 'var(--mui-palette-primary-main)'
          },
          '&:hover, &.Mui-focused, &.Mui-focusVisible': {
            backgroundColor: 'var(--mui-palette-primary-mainOpacity)'
          }
        },
        '&.Mui-disabled': {
          color: 'var(--mui-palette-text-disabled)',
          opacity: 0.45
        }
      })
    }
  }
})

export default menu
