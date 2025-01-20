import { DataGrid } from '@mui/x-data-grid';

export default function ColumnMenuGrid({ columns, rows }: { columns: any; rows: any }) {

  return (
    <div style={{ height: 400, width: '100%' }}>
      <DataGrid rows={rows} columns={columns} />
    </div>
  );
}