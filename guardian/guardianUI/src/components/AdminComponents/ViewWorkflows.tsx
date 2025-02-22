import { DataGrid, GridColDef } from '@mui/x-data-grid';
import Paper from '@mui/material/Paper';
import { Button, Divider, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { fetchWorkflows } from '../../services/workflowService';
import { useNavigate } from 'react-router-dom';

const columns: GridColDef[] = [
  { field: 'id', headerName: 'ID', width: 70, headerClassName: 'userheader'},
  { field: 'name', headerName: 'Name', width: 300, headerClassName: 'userheader' },
  { field: 'workflowType', headerName: 'Type', width: 130, headerClassName: 'userheader' },
  { field: 'isExternal', headerName: 'External', width: 200, headerClassName: 'userheader', hideable: false},
  { field: 'isActive', headerName: 'Status', width: 90, headerClassName: 'userheader', hideable: false},
  
];

const paginationModel = { page: 0, pageSize: 5 };

export default function WorkflowListTable() {
  const navigate = useNavigate();

  const { isLoading, error, data } = useQuery({queryKey: ['workflowGrid'], queryFn: fetchWorkflows, staleTime: 0, gcTime: 0, retry: 2});

  if(isLoading) return <div>Loading...</div>

  if(error) return <div>Error: {error.message}</div>

  return (
    <Paper sx={{ height: 400, width: 1000, mt: 15 }}>
        <Typography variant="h5" sx={{mt: 2, ml: 2}} gutterBottom>View Workflows</Typography>
        <Button sx={{ ml: 2, mt: 2 }} variant="contained" size="small">Create a New Workflow</Button>
        <Divider sx={{ mt: 3, width: '100%' }} />
      <DataGrid
        rows={data}
        columns={columns}
        initialState={{ pagination: { paginationModel } }}
        pageSizeOptions={[5, 10]}
        // getRowId={(row) => row.workflowId}
        onRowClick={({row}) => 
          navigate(`/admin/editworkflow/${row.id}`)
      }
        sx={{
            boxShadow: 2,
            border: 2,
            borderColor: 'primary.light',
            '& .MuiDataGrid-cell:hover': {
              color: 'primary.main',
            },
          }}
      />
    </Paper>
  );
}
