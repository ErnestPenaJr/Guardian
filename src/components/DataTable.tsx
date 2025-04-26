import React, { useState, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { Search, Shield } from 'lucide-react';
import { movies, Movie } from '../database';
import { showToast } from '../utils/toast';

export function CustomDataTable() {
  const [filterText, setFilterText] = useState('');

  const filteredItems = useMemo(() =>
    movies.filter(item => {
      const searchStr = filterText.toLowerCase();
      return (
        item.title.toLowerCase().includes(searchStr) ||
        item.year.toString().includes(searchStr) ||
        item.rating.toString().includes(searchStr)
      );
    }),
    [filterText]
  );

  const columnDefs = useMemo(() => [
    { headerName: 'Title', field: 'title', sortable: true, filter: true },
    { headerName: 'Year', field: 'year', sortable: true, filter: true },
    { headerName: 'Rating', field: 'rating', sortable: true, filter: true },
  ], []);

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-4xl">
      <div className="flex justify-center mb-6">
        <Shield className="w-12 h-12 text-secondary" />
      </div>
      
      <h1 className="text-h4 font-display text-center font-bold text-primary mb-8">Guardian</h1>

      <div className="mb-6 relative">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-3" />
        </div>
        <input
          type="text"
          placeholder="Search movies..."
          value={filterText}
          onChange={e => setFilterText(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-5 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
        />
      </div>

      <div className="ag-theme-alpine" style={{ height: 400, width: '100%' }}>
        <AgGridReact
          rowData={filteredItems}
          columnDefs={columnDefs}
          pagination={true}
          paginationPageSize={5}
          domLayout="autoHeight"
        />
      </div>

      <div className="mt-8 pt-8 border-t border-gray-5 text-center">
        <p className="text-body-sm text-gray-3">
          Powered by <span className="font-semibold">Shieldlytics</span>
        </p>
      </div>
    </div>
  );
}