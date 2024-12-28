import { createTheme } from '@mui/material/styles';

const theme = {
  palette: {
    mode: 'light',
    primary: {
      main: '#189ab4', //'#05445e',
    },
    secondary: {
      main: '#75e6da', //'#189ab4',
    },
    info: {
      main: '#D4F1F4', //'#75e6da',
    },
    background: {
      default: '#D4F1F4'
    },
  },
  typography: {
    fontFamily: `"Poppins", "Arial", sans-serif`,
    fontSize: 14,
    fontWeightLight: 300,
    fontWeightRegular: 400,
    fontWeightMedium: 500,
  },
} as const;
  
type CustomTheme = {
    [Key in keyof typeof theme]: typeof theme[Key]
}

declare module '@mui/material/styles/createTheme' {
    interface Theme extends CustomTheme { }
    interface ThemeOptions extends CustomTheme { }
}

export default createTheme(theme)