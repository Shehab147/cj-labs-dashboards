// React Imports
import React from 'react'

// MUI Imports
import type { Theme } from '@mui/material/styles'

const SelectIcon = () => {
  return <i className='tabler-chevron-down' />
}

const iconStyles = (theme: Theme) => ({
  userSelect: 'none',
  display: 'inline-block',
  fill: 'currentColor',
  flexShrink: 0,
  transition: theme.transitions.create('fill', {
    duration: theme.transitions.duration.shorter
  }),
  fontSize: '1.25rem',
  position: 'absolute',
  top: '50%',
  right: '1rem',
  transform: 'translateY(-50%)',
  pointerEvents: 'none'
})

const select: Theme['components'] = {
  MuiSelect: {
    defaultProps: {
      IconComponent: SelectIcon
    },
    styleOverrides: {
      select: ({ theme, ownerState }) => ({
        ...(ownerState.variant === 'outlined' && {
          minHeight: '1.4375em',
          display: 'flex',
          alignItems: 'center'
        }),
        '&[aria-expanded="true"] ~ i, &[aria-expanded="true"] ~ svg': {
          transform: 'translateY(-50%) rotate(180deg)'
        },
        '& ~ i, & ~ svg': iconStyles(theme as Theme),
        '&.MuiInputBase-inputSizeSmall': {
          '& ~ i, & ~ svg': {
            height: '1.125rem',
            width: '1.125rem'
          }
        },
        '&:not(aria-label="Without label") ~ .MuiOutlinedInput-notchedOutline > legend > span': {
          paddingInline: '5px'
        }
      })
    }
  },
  MuiNativeSelect: {
    styleOverrides: {
      select: ({ theme }) => ({
        '& + i, & + svg': iconStyles(theme as Theme)
      })
    }
  }
}

export default select
