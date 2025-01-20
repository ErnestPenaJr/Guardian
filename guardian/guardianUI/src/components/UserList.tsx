import * as React from 'react';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import Paper from '@mui/material/Paper';

const columns: GridColDef[] = [
  //{ field: 'id', headerName: 'ID', width: 70, headerClassName: 'userheader'},
  {
    field: 'fullName',
    headerName: 'Full Name',
    description: 'This is their full name lol',
    sortable: false,
    hideable: false,
    width: 200,
    valueGetter: (value, row) => `${row.firstName || ''} ${row.lastName || ''}`,
  },
  //{ field: 'firstName', headerName: 'First name', width: 130, headerClassName: 'userheader' },
  //{ field: 'lastName', headerName: 'Last name', width: 130, headerClassName: 'userheader' },
  { field: 'email', headerName: 'Email', width: 200, headerClassName: 'userheader', hideable: false},
  { field: 'role', headerName: 'Role', width: 130, headerClassName: 'userheader', hideable: false},
  { field: 'userstatus', headerName: 'Status', width: 90, headerClassName: 'userheader', hideable: false},
  
];

const rows = [
  { id: 1, lastName: 'Boy', firstName: 'Jon', email: 'jon@fbi.com', role: 'External User', userstatus: 'Active' },
  { id: 2, lastName: 'Investigator', firstName: 'Bob', email: 'bob@fbi.com', role: 'Processor', userstatus: 'Active' },
  { id: 3, lastName: 'Geller', firstName: 'Ross', email: 'ross@fbi.com', role: 'General User', userstatus: 'Pending' },
  { id: 4, lastName: 'Bing', firstName: 'Monica', email: 'monica@fbi.com', role: 'General User', userstatus: 'Invited' },
  { id: 5, lastName: 'Loser', firstName: 'Big', email: 'loser@fbi.com', role: 'External User', userstatus: 'Denied' },
  { id: 6, lastName: 'Buffay', firstName: 'Phoebe', email: 'phoebe@fbi.com', role: 'Administrator', userstatus: 'Active' },
  { id: 7, lastName: 'Bong', firstName: ' Ms Chanandler', email: 'chananadler@fbi.com', role: 'External User', userstatus: 'Invited' },
  { id: 8, lastName: 'Coffee', firstName: 'Gunther', email: 'gunther@fbi.com', role: 'Manager', userstatus: 'Active' },
  { id: 9, lastName: 'Tribbianni', firstName: 'Joey', email: 'joey@fbi.com', role: 'External User', userstatus: 'Pending' },
];

const paginationModel = { page: 0, pageSize: 5 };

export default function UserTable() {
  return (
    <Paper sx={{ height: 400, width: 1000 }}>
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
        //checkboxSelection
        //sx={{ border: 0 }}
      />
    </Paper>
  );
}
