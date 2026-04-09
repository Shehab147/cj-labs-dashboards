// MUI Imports
import type { Theme } from '@mui/material/styles'

// Type Imports
import type { Skin } from '@core/types'

/**
 * X-Station Design Language - Cards
 * 
 * Flat
 * Border > shadow
 * Used only to group content, not decorate
 * Radius: 12px
 */

const card = (skin: Skin): Theme['components'] => {
  return {
    MuiCard: {
      defaultProps: {
        // X-Station Design Language: Border > shadow (always use bordered)
        variant: 'outlined'
      },
      styleOverrides: {
        root: () => ({
          // X-Station Design Language: 12px radius, flat, no shadow
          borderRadius: 12,
          boxShadow: 'none',
          borderColor: 'var(--mui-palette-divider)'
        })
      }
    },
    MuiCardHeader: {
      styleOverrides: {
        root: ({ theme }) => ({
          padding: theme.spacing(5),
          '& + .MuiCardContent-root, & + .MuiCardActions-root': {
            paddingBlockStart: 0
          },
          '& + .MuiCollapse-root .MuiCardContent-root:first-child, & + .MuiCollapse-root .MuiCardActions-root:first-child':
            {
              paddingBlockStart: 0
            }
        }),
        subheader: ({ theme }) => ({
          ...theme.typography.body2,
          color: 'var(--mui-palette-text-secondary)'
        }),
        action: ({ theme }) => ({
          ...theme.typography.body1,
          color: 'var(--mui-palette-text-disabled)',
          marginBlock: 0,
          marginInlineEnd: 0,
          '& .MuiIconButton-root': {
            color: 'inherit'
          }
        })
      }
    },
    MuiCardContent: {
      styleOverrides: {
        root: ({ theme }) => ({
          padding: theme.spacing(5),
          color: 'var(--mui-palette-text-secondary)',
          '&:last-child': {
            paddingBlockEnd: theme.spacing(5)
          },
          '& + .MuiCardHeader-root, & + .MuiCardContent-root, & + .MuiCardActions-root': {
            paddingBlockStart: 0
          },
          '& + .MuiCollapse-root .MuiCardHeader-root:first-child, & + .MuiCollapse-root .MuiCardContent-root:first-child, & + .MuiCollapse-root .MuiCardActions-root:first-child':
            {
              paddingBlockStart: 0
            }
        })
      }
    },
    MuiCardActions: {
      styleOverrides: {
        root: ({ theme }) => ({
          padding: theme.spacing(5),
          '& .MuiButtonBase-root:not(:first-of-type)': {
            marginInlineStart: theme.spacing(4)
          },
          '&:where(.card-actions-dense)': {
            padding: theme.spacing(3),
            '& .MuiButton-text': {
              paddingInline: theme.spacing(3)
            }
          },
          '& + .MuiCardHeader-root, & + .MuiCardContent-root, & + .MuiCardActions-root': {
            paddingBlockStart: 0
          },
          '& + .MuiCollapse-root .MuiCardHeader-root:first-child, & + .MuiCollapse-root .MuiCardContent-root:first-child, & + .MuiCollapse-root .MuiCardActions-root:first-child':
            {
              paddingBlockStart: 0
            }
        })
      }
    }
  }
}

export default card
