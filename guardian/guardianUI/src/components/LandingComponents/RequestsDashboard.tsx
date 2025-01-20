import * as React from 'react';
import { styled } from '@mui/material/styles';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell, { tableCellClasses } from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import { Chip, Divider, Stack, Typography } from '@mui/material';
import { CircleRounded, ListAlt } from '@mui/icons-material';

const StyledTableCell = styled(TableCell)(({ theme }) => ({
  [`&.${tableCellClasses.head}`]: {
    backgroundColor: theme.palette.common.white,
    color: theme.palette.common.black,
  },
  [`&.${tableCellClasses.body}`]: {
    fontSize: 14,
  },
}));

const StyledTableRow = styled(TableRow)(({ theme }) => ({
  '&:nth-of-type(odd)': {
    backgroundColor: theme.palette.action.hover,
  },
  // hide last border
  '&:last-child td, &:last-child th': {
    border: 0,
  },
}));

const theStatus = new Map<string, string>([
    ["Completed", "#05445e"],
    ["In Progress", "#189ab4"],
    ["Pending", "#75e6da"]
])

const thePriority = new Map<string, string>([
    ["Low", "#abf0ae"],
    ["Medium", "#fff59b"],
    ["High", "#ff8f8f"]
])

function createData(
  id: number,
  status: string,
  requester: string,
  createDate: string,
  requestType: string,
  priority: string,
) {
  return { id, status, requester, createDate, requestType, priority };
}

const rows = [
  createData(1, 'In Progress', 'John Doe', 'Address', '2021-10-01', 'High'),
  createData(2, 'Pending', 'Jane Doe', 'Financial', '2024-11-01', 'Low'),
  createData(3, 'Pending', 'Bob Doe', 'Subject', '2022-03-01', 'Medium'),
  createData(4, 'In Progress', 'Carla Doe', 'Address', '2023-07-01', 'High'),
  createData(5, 'Completed', 'Jim Doe', 'Vehicle', '2020-09-01', 'Low'),
];

export default function RequestsDashboard() {
  return (
    <Paper>
    <Stack mt={1} ml={2} pt={2} mb={2} direction={'row'} spacing={2}>
    <ListAlt sx={{ mt: 1 }} /> 
    <Typography variant="h6" gutterBottom display={'flex'} justifyContent={'left'}>Requests Queue</Typography>
    </Stack>
    <Divider />
    <TableContainer component={Paper}>
      <Table sx={{ minWidth: 400, minHeight: 300 }} size="small" aria-label="request queue table">
        <TableHead>
          <TableRow>
            <StyledTableCell align="left">Status</StyledTableCell>
            <StyledTableCell align="left">Requester</StyledTableCell>
            <StyledTableCell align="left">Date/Time</StyledTableCell>
            <StyledTableCell align="left">Request Type</StyledTableCell>
            <StyledTableCell align="center">Priority</StyledTableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <StyledTableRow key={row.id}>
              <StyledTableCell component="th" scope="row" align="left">
                <Chip label={row.status} sx={{background: theStatus?.get(row.status), color: 'white', minWidth: '65%'}} />
              </StyledTableCell>
              <StyledTableCell align="left">{row.requester}</StyledTableCell>
              <StyledTableCell align="left">{row.requestType}</StyledTableCell>
              <StyledTableCell align="left">{row.createDate}</StyledTableCell>
              <StyledTableCell align="center"><CircleRounded sx={{color: thePriority?.get(row.priority)}} /></StyledTableCell>
            </StyledTableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
    </Paper>
  );
}
