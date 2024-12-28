import './App.css'
import { ThemeProvider } from '@emotion/react'
import { Box, createTheme, CssBaseline } from '@mui/material'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { MainLayout } from './components/Layouts'
import LandingPage from './pages/LandingPage'
import Theme from './components/Theme'

const router = createBrowserRouter([
  {
    element: <MainLayout />,
    children: [
      {
        path: '/',
        element: <LandingPage />
      },
    ]
  },
], { basename: '/' })


function App() {

  let guardianTheme = createTheme(Theme);
  
  return (
    <ThemeProvider theme={guardianTheme}>
      <CssBaseline />
      <Box sx={{ display: 'flex' }}>
        <RouterProvider router={router} />
      </Box>
    </ThemeProvider>
  )
}

export default App
