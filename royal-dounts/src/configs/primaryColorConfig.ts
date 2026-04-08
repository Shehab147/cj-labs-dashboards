export type PrimaryColorConfig = {
  name?: string
  light?: string
  main: string
  dark?: string
}

// Primary color config object - X-Station Design Language
// Primary: #5b0e00 — actions only
const primaryColorConfig: PrimaryColorConfig[] = [
  {
    name: 'primary-1',
    light: '#7a1a0a',
    main: '#5b0e00',
    dark: '#3d0900'
  }
]

export default primaryColorConfig
