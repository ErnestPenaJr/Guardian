import './App.css'
import { ThemeProvider } from '@emotion/react'
import { Box, createTheme, CssBaseline } from '@mui/material'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { MainLayout } from './components/Layouts'
import LandingPage from './pages/LandingPage'
import Theme from './components/Theme'
import { ManageUsers } from './pages/ManageUsers'
import { ProcessorDashboard } from './pages/ProcessorDashboard'
import { FormPage } from './pages/FormPage'
import { RequestsPage } from './pages/RequestsPage'
import { NoticesPage } from './pages/NoticesPage'
import WorkflowListTable from './components/AdminComponents/ViewWorkflows'
import { EditWorkflowDetails } from './pages/EditWorkflowDetails'

const router = createBrowserRouter([
  {
    element: <MainLayout />,
    children: [
      {
        path: '/',
        element: <LandingPage />
      },
      {
        path: '/admin',
        children: [
          {path: 'manageusers', element: <ManageUsers />},
          {path: 'formbuilder', element: <FormPage />},
          {path: 'workflows', element: <WorkflowListTable />},
          {path: 'editworkflow', element: <EditWorkflowDetails />},
        ]
      },
      {
        path: '/processor',
        children: [
          {path: 'dashboard', element: <ProcessorDashboard />}
        ]
      },
      {
        path: '/requests',
        children: [
          {path: 'viewrequests', element: <RequestsPage />}
        ]
      },
      {
        path: '/notices',
        children: [
          {path: 'viewnotices', element: <NoticesPage />}
        ]
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
