import React, { useState } from 'react';
import DataTable from 'react-data-table-component';
import { Search, Shield } from 'lucide-react';
import { movies, Movie } from '../database';
import { showToast } from '../utils/toast';

const columns = [
  {
    name: 'Title',
    selector: (row: Movie) => row.title,
    sortable: true,
  },
  {
    name: 'Year',
    selector: (row: Movie) => row.year,
    sortable: true,
  },
  {
    name: 'Rating',
    selector: (row: Movie) => row.rating,
    sortable: true,
  },
];

const customStyles = {
  table: {
    style: {
      backgroundColor: 'white',
      borderRadius: '0.5rem',
    },
  },
  headRow: {
    style: {
      backgroundColor: 'rgba(224, 224, 224, 0.2)',
      borderBottomWidth: '1px',
      borderBottomColor: '#E0E0E0',
      minHeight: '3.75rem',
    },
  },
  headCells: {
    style: {
      fontSize: '0.875rem',
      fontWeight: '600',
      color: '#333333',
      padding: '1rem 1.5rem',
    },
  },
  cells: {
    style: {
      fontSize: '1rem',
      padding: '1rem 1.5rem',
      color: '#4F4F4F',
    },
  },
  rows: {
    style: {
      backgroundColor: 'white',
      '&:hover': {
        backgroundColor: 'rgba(224, 224, 224, 0.1)',
        cursor: 'pointer',
      },
      borderBottomWidth: '1px',
      borderBottomColor: '#E0E0E0',
      minHeight: '3.75rem',
    },
  },
  pagination: {
    style: {
      borderTopWidth: '1px',
      borderTopColor: '#E0E0E0',
      padding: '1rem',
    },
  },
};

export function CustomDataTable() {
  const [filterText, setFilterText] = useState('');
  
  const filteredItems = movies.filter(
    item => {
      const searchStr = filterText.toLowerCase();
      return (
        item.title.toLowerCase().includes(searchStr) ||
        item.year.toString().includes(searchStr) ||
        item.rating.toString().includes(searchStr)
      );
    }
  );

  const handleSort = (column: any, sortDirection: string) => {
    showToast.info(`Sorted by ${column.name} ${sortDirection}`);
  };

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

      <DataTable
        columns={columns}
        data={filteredItems}
        customStyles={customStyles}
        pagination
        paginationPerPage={5}
        paginationRowsPerPageOptions={[5, 10, 15, 20]}
        onSort={handleSort}
        responsive
        highlightOnHover
      />

      <div className="mt-8 pt-8 border-t border-gray-5 text-center">
        <p className="text-body-sm text-gray-3">
          Powered by <span className="font-semibold">Shieldlytics</span>
        </p>
      </div>
    </div>
  );
}