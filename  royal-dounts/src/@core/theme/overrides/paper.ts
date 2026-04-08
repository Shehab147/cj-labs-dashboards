// MUI Imports
import type { Theme } from '@mui/material/styles'

/**
 * X-Station Design Language - Paper
 * Radius: 12px
 * No gradients
 */

const paper: Theme['components'] = {
  MuiPaper: {
    styleOverrides: {
      root: {
        backgroundImage: 'none',
        borderRadius: 12
      }
    }
  }
}

export default paper
