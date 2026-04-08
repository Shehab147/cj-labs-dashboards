// MUI Imports
import type { Theme } from '@mui/material/styles'

/**
 * X-Station Design Language Typography
 * 
 * Font: Inter (system fallback allowed)
 * 
 * Core Sizes:
 * Title: 24–30px / SemiBold
 * Section: 18–20px / Medium
 * Body: 16px / Regular
 * Caption: 12–14px / Regular
 * 
 * Text is the UI - fewer sizes, used consistently
 * Large body text, generous spacing
 */

const typography = (fontFamily: string): Theme['typography'] =>
  ({
    fontFamily:
      typeof fontFamily === 'undefined' || fontFamily === ''
        ? [
            'Inter',
            '-apple-system',
            'BlinkMacSystemFont',
            '"Segoe UI"',
            'Roboto',
            '"Helvetica Neue"',
            'Arial',
            'sans-serif'
          ].join(',')
        : fontFamily,
    fontSize: 16,
    h1: {
      fontSize: '1.875rem', // 30px - Title
      fontWeight: 600,
      lineHeight: 1.4
    },
    h2: {
      fontSize: '1.5rem', // 24px - Title
      fontWeight: 600,
      lineHeight: 1.4
    },
    h3: {
      fontSize: '1.25rem', // 20px - Section
      fontWeight: 500,
      lineHeight: 1.5
    },
    h4: {
      fontSize: '1.125rem', // 18px - Section
      fontWeight: 500,
      lineHeight: 1.5
    },
    h5: {
      fontSize: '1rem', // 16px - Body large
      fontWeight: 500,
      lineHeight: 1.5
    },
    h6: {
      fontSize: '0.875rem', // 14px
      fontWeight: 500,
      lineHeight: 1.5
    },
    subtitle1: {
      fontSize: '1rem', // 16px
      fontWeight: 400,
      lineHeight: 1.5
    },
    subtitle2: {
      fontSize: '0.875rem', // 14px
      fontWeight: 400,
      lineHeight: 1.5
    },
    body1: {
      fontSize: '1rem', // 16px - Body
      fontWeight: 400,
      lineHeight: 1.5
    },
    body2: {
      fontSize: '0.875rem', // 14px
      fontWeight: 400,
      lineHeight: 1.5
    },
    button: {
      fontSize: '1rem', // 16px
      fontWeight: 500,
      lineHeight: 1.5,
      textTransform: 'none'
    },
    caption: {
      fontSize: '0.75rem', // 12px - Caption
      fontWeight: 400,
      lineHeight: 1.5,
      letterSpacing: '0.2px'
    },
    overline: {
      fontSize: '0.75rem', // 12px
      fontWeight: 500,
      lineHeight: 1.5,
      letterSpacing: '0.5px',
      textTransform: 'uppercase'
    }
  }) as Theme['typography']

export default typography
