import * as React from 'react';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import Paper from '@mui/material/Paper';
import { Button, Divider, Typography } from '@mui/material';

const columns: GridColDef[] = [
  //{ field: 'id', headerName: 'ID', width: 70, headerClassName: 'userheader'},
  { field: 'name', headerName: 'Name', width: 300, headerClassName: 'userheader' },
  { field: 'type', headerName: 'Type', width: 130, headerClassName: 'userheader' },
  { field: 'external', headerName: 'External', width: 200, headerClassName: 'userheader', hideable: false},
  { field: 'status', headerName: 'Status', width: 90, headerClassName: 'userheader', hideable: false},
  
];

const rows = [
  { id: 1, name: '1st awesome workflow', type: 'Request', external: true, status: true },
  { id: 2, name: '2nd awesome workflow', type: 'Notice', external: true, status: true },
  { id: 3, name: '3rd awesome workflow', type: 'Request', external: true, status: false },
];

const paginationModel = { page: 0, pageSize: 5 };

export default function WorkflowListTable() {
  return (
    <Paper sx={{ height: 400, width: 1000, mt: 15 }}>
        <Typography variant="h5" sx={{mt: 2, ml: 2}} gutterBottom>View Workflows</Typography>
        <Button sx={{ ml: 2, mt: 2 }} variant="contained" size="small">Create a New Workflow</Button>
        <Divider sx={{ mt: 3, width: '100%' }} />
      <DataGrid
        rows={rows}
        columns={columns}
        initialState={{ pagination: { paginationModel } }}
        pageSizeOptions={[5, 10]}
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
