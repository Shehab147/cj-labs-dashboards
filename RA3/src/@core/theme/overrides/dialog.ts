//MUI Imports
import type { Theme } from '@mui/material/styles'

//Type Imports
import type { Skin } from '@core/types'

/**
 * X-Station Design Language - Modals
 * 
 * Slide up
 * Used sparingly
 * Prefer full screens
 * Keyboard-safe by default
 * Radius: 12px
 */

const dialog = (skin: Skin): Theme['components'] => ({
  MuiDialog: {
    styleOverrides: {
      paper: ({ theme }) => ({
        // X-Station Design Language: 12px radius, no shadow, border only
        borderRadius: 12,
        boxShadow: 'none',
        border: '1px solid var(--mui-palette-divider)',
        [theme.breakpoints.down('sm')]: {
          '&:not(.MuiDialog-paperFullScreen)': {
            margin: theme.spacing(5)
          }
        }
      }),
      paperFullScreen: {
        borderRadius: 0,
        border: 'none'
      }
    }
  },
  MuiDialogTitle: {
    defaultProps: {
      variant: 'h5'
    },
    styleOverrides: {
      root: ({ theme }) => ({
        padding: theme.spacing(5),
        '& + .MuiDialogActions-root': {
          paddingTop: 0
        }
      })
    }
  },
  MuiDialogContent: {
    styleOverrides: {
      root: ({ theme }) => ({
        padding: theme.spacing(5),
        '& + .MuiDialogContent-root, & + .MuiDialogActions-root': {
          paddingTop: 0
        }
      })
    }
  },
  MuiDialogActions: {
    styleOverrides: {
      root: ({ theme }) => ({
        padding: theme.spacing(5),
        '& .MuiButtonBase-root:not(:first-of-type)': {
          marginInlineStart: theme.spacing(4)
        },
        '&:where(.dialog-actions-dense)': {
          padding: theme.spacing(3),
          '& .MuiButton-text': {
            paddingInline: theme.spacing(3)
          }
        }
      })
    }
  }
})

export default dialog
