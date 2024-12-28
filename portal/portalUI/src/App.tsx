import { useState } from 'react'
import './App.css'
import { ThemeProvider } from '@emotion/react'
import { Box, createTheme, CssBaseline } from '@mui/material'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { MainLayout } from './components/Layouts'
import LandingPage from './pages/ShieldlyticsLanding'
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

  let shieldTheme = createTheme(Theme);
  
  return (
    <ThemeProvider theme={shieldTheme}>
      <CssBaseline />
      <Box sx={{ display: 'flex' }}>
        <RouterProvider router={router} />
      </Box>
    </ThemeProvider>
  )
}

export default App
