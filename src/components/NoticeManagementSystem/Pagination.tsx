import {
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
} from "lucide-react";

export type PaginationProps = {
  totalPages: number;
  rowsPerPage: number;
  currentPage: number;
  totalRows?: number;
  selectedRows?: number;
  showSelectedRowCount?: boolean;
  showRowsPerPage?: boolean;
  handlePageChange: (newPage: number) => void;
  handleRowsPerPageChange: (rows: number) => void;
};

/**
 * Shared pagination component used in AllNotices and DeliveryStatusDashboard.
 * Shows "Showing X–Y of Z", optional rows-per-page, and first/prev/next/last controls.
 */
const PaginationPage = ({
  totalPages,
  rowsPerPage,
  currentPage,
  totalRows = 0,
  selectedRows = 0,
  showSelectedRowCount = true,
  showRowsPerPage = true,
  handlePageChange,
  handleRowsPerPageChange,
}: PaginationProps) => {
  const safeTotalPages = Math.max(1, totalPages);
  const startIndex = totalRows === 0 ? 0 : (currentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, totalRows);
  const showingText =
    totalRows === 0
      ? "Showing 0 of 0"
      : `Showing ${startIndex + 1}-${endIndex} of ${totalRows}`;

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-gray-200 pt-4">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="text-sm text-gray-600">{showingText}</div>

        <div className="flex flex-col items-center gap-2 text-sm font-medium text-gray-900 sm:flex-row sm:gap-6">
          {showRowsPerPage && (
            <div className="flex items-center gap-2">
              <span className="text-gray-600">Rows per page</span>
              <select
                className="h-8 w-[72px] rounded-md border border-gray-300 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={rowsPerPage}
                onChange={(e) =>
                  handleRowsPerPageChange(Number(e.target.value))
                }
              >
                {[5, 10, 20, 50].map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </select>
            </div>
          )}

          <span className="text-gray-600">
            Page {currentPage} of {safeTotalPages}
          </span>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handlePageChange(1)}
              disabled={currentPage <= 1}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-50"
              aria-label="First page"
            >
              <ChevronsLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-50"
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= safeTotalPages}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-50"
              aria-label="Next page"
            >
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              onClick={() => handlePageChange(safeTotalPages)}
              disabled={currentPage >= safeTotalPages}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-50"
              aria-label="Last page"
            >
              <ChevronsRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {showSelectedRowCount && selectedRows > 0 && (
        <div className="text-sm text-gray-500">
          {selectedRows} of {totalRows} row(s) selected.
        </div>
      )}
    </div>
  );
};

export default PaginationPage;
