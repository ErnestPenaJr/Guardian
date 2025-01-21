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
import { CircleRounded, EmailOutlined, ListAlt, SmsOutlined } from '@mui/icons-material';

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
  category: string,
  title: string,
  from: string,
  createDate: string,
  priority: string,
) {
  return { id, category, title, from, createDate, priority };
}

const rows = [
  createData(1, 'Update', 'The curious case of benjamin button', 'John Doe', '10/27/2021 10:01 AM', 'High'),
  createData(2, 'Collaboration', 'New Taylor Swift collab w/Ed Sheeran is happening folks', 'Jane Doe', '11/11/2024 1:15 PM', 'Low'),
  createData(3, 'Bulletin', 'This is a news point bulletin, BOLO for weird stuff', 'Bob Doe', '03/01/2022 1:30 PM', 'Medium'),
  createData(4, 'Guidelines', 'Guidelines for filling out shiz, they are awesome', 'Carla Doe', '07/01/2023 6:27 PM', 'High'),
  createData(5, 'Invitation', 'You are invited to pure awesomeness', 'Jim Doe', '09/17/2020 8:03 AM', 'Low'),
  createData(6, 'Notice', 'Notice dis plz', 'Jim Doe', '09/01/2020 6:00 AM', 'Low'),
];

export default function NoticesDashboard() {
  return (
    <Paper>
    <Stack mt={2} ml={2} pt={2} direction={'row'} spacing={2}>
    <SmsOutlined sx={{ mt: 1 }} /> 
    <Typography variant="h6" gutterBottom display={'flex'} justifyContent={'left'}>Notices</Typography>
    </Stack>
    <Divider />
    <TableContainer component={Paper}>
      <Table sx={{ minWidth: 400 }} size="small" aria-label="notices table">
        <TableHead>
          <TableRow>
            <StyledTableCell align="left">Category</StyledTableCell>
            <StyledTableCell align="left">Title</StyledTableCell>
            <StyledTableCell align="left">From</StyledTableCell>
            <StyledTableCell align="left">Date/Time</StyledTableCell>
            <StyledTableCell align="center">Priority</StyledTableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <StyledTableRow key={row.id}>
              <StyledTableCell component="th" scope="row" align="left">{row.category}</StyledTableCell>
              <StyledTableCell align="left">{row.title}</StyledTableCell>
              <StyledTableCell align="left"><EmailOutlined sx={{ pt: 1 }} /> {row.from}</StyledTableCell>
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
