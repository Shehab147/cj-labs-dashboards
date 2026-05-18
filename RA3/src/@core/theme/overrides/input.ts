// MUI Imports
import type { Theme } from '@mui/material/styles'

/**
 * X-Station Design Language - Inputs
 * 
 * Height: 52px
 * Background: #F5F5F5
 * Border: subtle, visible
 * Clear focus state
 * Radius: 12px
 */

const input: Theme['components'] = {
  MuiFormControl: {
    styleOverrides: {
      root: {
        '&:has(.MuiRadio-root) .MuiFormHelperText-root, &:has(.MuiCheckbox-root) .MuiFormHelperText-root, &:has(.MuiSwitch-root) .MuiFormHelperText-root':
          {
            marginInline: 0
          }
      }
    }
  },
  MuiInputBase: {
    styleOverrides: {
      root: {
        lineHeight: 1.5,
        // X-Station Design Language: 12px radius
        borderRadius: 12,
        '&.MuiInput-underline': {
          '&:before': {
            borderColor: 'var(--mui-palette-customColors-inputBorder)'
          },
          '&:not(.Mui-disabled, .Mui-error):hover:before': {
            borderColor: 'var(--mui-palette-action-active)'
          }
        },
        '&.Mui-disabled .MuiInputAdornment-root, &.Mui-disabled .MuiInputAdornment-root > *': {
          color: 'var(--mui-palette-action-disabled)'
        }
      }
    }
  },
  MuiFilledInput: {
    styleOverrides: {
      root: {
        // X-Station Design Language: 12px radius, 52px height, #F5F5F5 background
        borderRadius: 12,
        minHeight: 52,
        backgroundColor: 'var(--mui-palette-FilledInput-bg)',
        '&:before': {
          display: 'none'
        },
        '&:after': {
          display: 'none'
        },
        '&:hover': {
          backgroundColor: 'var(--mui-palette-FilledInput-hoverBg)'
        },
        '&.Mui-focused': {
          backgroundColor: 'var(--mui-palette-FilledInput-bg)'
        },
        '&.Mui-disabled': {
          backgroundColor: 'var(--mui-palette-FilledInput-disabledBg)'
        }
      }
    }
  },
  MuiInputLabel: {
    styleOverrides: {
      shrink: ({ ownerState }) => ({
        ...(ownerState.variant === 'outlined' && {
          transform: 'translate(14px, -8px) scale(0.867)'
        }),
        ...(ownerState.variant === 'filled' && {
          transform: `translate(12px, ${ownerState.size === 'small' ? 4 : 7}px) scale(0.867)`
        }),
        ...(ownerState.variant === 'standard' && {
          transform: 'translate(0, -1.5px) scale(0.867)'
        })
      })
    }
  },
  MuiOutlinedInput: {
    styleOverrides: {
      root: {
        // X-Station Design Language: 12px radius
        borderRadius: 12,
        '&:not(.Mui-focused):not(.Mui-error):not(.Mui-disabled):hover .MuiOutlinedInput-notchedOutline': {
          borderColor: 'var(--mui-palette-action-active)'
        },
        '&.Mui-disabled .MuiOutlinedInput-notchedOutline': {
          borderColor: 'var(--mui-palette-divider)'
        },
        '&:not(.Mui-error).MuiInputBase-colorPrimary.Mui-focused': {
          boxShadow: 'none'
        }
      },
      input: ({ theme, ownerState }) => ({
        // X-Station Design Language: 52px height inputs
        ...(ownerState?.size === 'medium' && {
          '&:not(.MuiInputBase-inputMultiline, .MuiInputBase-inputAdornedStart)': {
            padding: theme.spacing(3.5, 4)
          },
          minHeight: 52,
          boxSizing: 'border-box'
        }),
        '& ~ .MuiOutlinedInput-notchedOutline': {
          borderColor: 'var(--mui-palette-customColors-inputBorder)'
        }
      }),
      notchedOutline: {
        '& legend': {
          fontSize: '0.867em'
        }
      }
    }
  },
  MuiInputAdornment: {
    styleOverrides: {
      root: {
        color: 'var(--mui-palette-text-primary)',
        '& i, & svg': {
          fontSize: '1rem !important'
        },
        '& *': {
          color: 'inherit !important'
        }
      }
    }
  },
  MuiFormHelperText: {
    styleOverrides: {
      root: {
        lineHeight: 1.5,
        letterSpacing: 'unset',
        marginTop: 6
      }
    }
  }
}

export default input
