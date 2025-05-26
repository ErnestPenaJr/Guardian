import React, { useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

const TestGrid: React.FC = () => {
  // Define the row data type
  interface RowDataType {
    id: number;
    name: string;
    type: string;
    required: boolean;
  }

  const [rowData] = useState<RowDataType[]>([
    { id: 1, name: 'Test 1', type: 'Text', required: true },
    { id: 2, name: 'Test 2', type: 'Number', required: false },
    { id: 3, name: 'Test 3', type: 'Date', required: true }
  ]);

  const [columnDefs] = useState<ColDef<RowDataType>[]>([
    { field: 'id', headerName: 'ID' },
    { field: 'name', headerName: 'Name' },
    { field: 'type', headerName: 'Type' },
    { field: 'required', headerName: 'Required' }
  ]);

  return (
    <div className="ag-theme-alpine" style={{ height: 300, width: '100%' }}>
      <AgGridReact
        rowData={rowData}
        columnDefs={columnDefs}
      />
    </div>
  );
};

export default TestGrid;
