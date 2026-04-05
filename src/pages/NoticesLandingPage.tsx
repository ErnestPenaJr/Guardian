import React, { useEffect, useState, useMemo } from 'react';
import DataTable, { TableColumn } from 'react-data-table-component';
import { toast } from 'react-toastify';
import { Search, Calendar, Filter, Plus, Bell, Eye, Users, AlertTriangle, Clock } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import noticeService, { Notice, NoticeFilters } from '../services/noticeService';
import CreateNoticeModal from '../components/CreateNoticeModal';
import '../styles/RequestDashboard.css'; // Reuse existing styles

interface NoticesLandingPageProps {}

const NoticesLandingPage: React.FC<NoticesLandingPageProps> = () => {
  const { user } = useAuth();
  
  // State management
  const [activeTab, setActiveTab] = useState<'my-notices' | 'all-notices'>('my-notices');
  const [myNotices, setMyNotices] = useState<Notice[]>([]);
  const [allNotices, setAllNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [noticeTypeFilter, setNoticeTypeFilter] = useState<string>('');
  const [unreadOnlyFilter, setUnreadOnlyFilter] = useState<boolean>(false);
  const [dateFromFilter, setDateFromFilter] = useState<string>('');
  const [dateToFilter, setDateToFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState<boolean>(false);
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);

  // Role-based access control - check if user can see "All Notices" tab
  const hasAllNoticesAccess = useMemo(() => {
    if (!user) return false;
    
    // Allow access for Processor(3), Manager(4), Admin(1), Super Admin(6)
    const allowedRoles = [1, 3, 4, 6];
    
    // Check roles array
    if (user.roles && Array.isArray(user.roles)) {
      return user.roles.some((role: any) => 
        typeof role === 'object' && role !== null && 
        allowedRoles.includes(role.id || role.role_id)
      );
    }
    
    // Check role as string (from JWT token)
    if (user.role) {
      const roleId = parseInt(user.role, 10);
      return allowedRoles.includes(roleId);
    }
    
    return false;
  }, [user]);

  // Check if user can create notices
  const hasCreateNoticeAccess = useMemo(() => {
    if (!user) return false;
    
    // Allow notice creation for Processor(3), Manager(4), Admin(1), Super Admin(6)
    const allowedRoles = [1, 3, 4, 6];
    
    if (user.roles && Array.isArray(user.roles)) {
      return user.roles.some((role: any) => 
        typeof role === 'object' && role !== null && 
        allowedRoles.includes(role.id || role.role_id)
      );
    }
    
    if (user.role) {
      const roleId = parseInt(user.role, 10);
      return allowedRoles.includes(roleId);
    }
    
    return false;
  }, [user]);

  // Load notices on component mount and when tab changes
  useEffect(() => {
    loadNotices();
  }, [activeTab, user]);

  // Load notices based on active tab
  const loadNotices = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const filters: NoticeFilters = {
        status: statusFilter || undefined,
        noticeType: noticeTypeFilter || undefined,
        unreadOnly: unreadOnlyFilter || undefined,
        dateFrom: dateFromFilter || undefined,
        dateTo: dateToFilter || undefined,
      };

      if (activeTab === 'my-notices') {
        const data = await noticeService.getMyNotices(filters);
        setMyNotices(data);
      } else if (activeTab === 'all-notices' && hasAllNoticesAccess) {
        const data = await noticeService.getAllNotices(filters);
        setAllNotices(data);
      }
    } catch (err: any) {
      console.error('Error loading notices:', err);
      setError(err.response?.data?.error || err.message || 'Failed to load notices');
      toast.error('Failed to load notices');
    } finally {
      setLoading(false);
    }
  };

  // Apply filters when filter values change
  useEffect(() => {
    if (!loading) {
      const timeoutId = setTimeout(() => {
        loadNotices();
      }, 300); // Debounce filter changes
      
      return () => clearTimeout(timeoutId);
    }
  }, [statusFilter, noticeTypeFilter, unreadOnlyFilter, dateFromFilter, dateToFilter]);

  // Get current notices based on active tab
  const currentNotices = useMemo(() => {
    return activeTab === 'my-notices' ? myNotices : allNotices;
  }, [activeTab, myNotices, allNotices]);

  // Apply search filter to current notices
  const filteredNotices = useMemo(() => {
    if (!searchTerm) return currentNotices;
    
    const searchStr = searchTerm.toLowerCase();
    return currentNotices.filter(notice => 
      notice.TITLE.toLowerCase().includes(searchStr) ||
      notice.CONTENT.toLowerCase().includes(searchStr) ||
      (notice.ISSUED_BY_USER?.FIRST_NAME?.toLowerCase().includes(searchStr)) ||
      (notice.ISSUED_BY_USER?.LAST_NAME?.toLowerCase().includes(searchStr))
    );
  }, [currentNotices, searchTerm]);

  // Handle notice row click - open in new window
  const handleNoticeClick = async (notice: Notice) => {
    try {
      // Mark as read first
      if (!notice._isRead) {
        await noticeService.markNoticeAsRead(notice.NOTICE_ID);
        // Refresh notices to update read status
        loadNotices();
      }
      
      // Open notice details in new window
      const noticeUrl = `/notices/${notice.NOTICE_ID}`;
      window.open(noticeUrl, '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
    } catch (error) {
      console.error('Error handling notice click:', error);
      toast.error('Failed to open notice');
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setNoticeTypeFilter('');
    setUnreadOnlyFilter(false);
    setDateFromFilter('');
    setDateToFilter('');
    toast.info('Filters cleared');
  };

  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  // Handler for when a notice is successfully created
  const handleNoticeCreated = () => {
    // Refresh the notices list
    loadNotices();
    // Close the modal
    setShowCreateModal(false);
  };

  // Priority helper functions
  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return <AlertTriangle size={14} className="text-danger" />;
      case 'MEDIUM':
        return <Bell size={14} className="text-warning" />;
      case 'LOW':
        return <Clock size={14} className="text-info" />;
      default:
        return <Bell size={14} className="text-secondary" />;
    }
  };

  const getPriorityBadgeClass = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return 'badge bg-danger';
      case 'MEDIUM':
        return 'badge bg-warning text-dark';
      case 'LOW':
        return 'badge bg-info';
      default:
        return 'badge bg-secondary';
    }
  };

  const getPrioritySortValue = (priority: string) => {
    switch (priority) {
      case 'HIGH': return 3;
      case 'MEDIUM': return 2;
      case 'LOW': return 1;
      default: return 0;
    }
  };

  // Due date helper function
  const getDueDateStatus = (dueDate: string | null) => {
    if (!dueDate) return null;
    
    const now = new Date();
    const due = new Date(dueDate);
    const diffHours = (due.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    if (diffHours < 0) {
      return { status: 'overdue', class: 'text-danger fw-bold', text: 'OVERDUE' };
    } else if (diffHours < 24) {
      return { status: 'urgent', class: 'text-warning fw-bold', text: 'DUE SOON' };
    } else if (diffHours < 72) {
      return { status: 'approaching', class: 'text-info', text: 'DUE SOON' };
    }
    return null;
  };

  // Define table columns
  const columns: TableColumn<Notice>[] = [
    {
      name: 'ID',
      selector: row => row.NOTICE_ID,
      sortable: true,
      width: '80px',
      cell: row => (
        <div className="fw-medium text-primary">
          #{row.NOTICE_ID}
        </div>
      )
    },
    {
      name: 'Title',
      selector: row => row.TITLE,
      sortable: true,
      width: '35%',
      cell: row => {
        const dueDateStatus = getDueDateStatus(row.DUE_DATE);
        return (
          <div className={`fw-medium ${!row._isRead ? 'text-info fw-bold' : ''}`}>
            <div className="d-flex align-items-center gap-2 mb-1">
              {getPriorityIcon(row.PRIORITY_LEVEL || 'MEDIUM')}
              <span>{row.TITLE}</span>
            </div>
            <div className="d-flex gap-1 flex-wrap">
              {!row._isRead && (
                <span className="badge bg-info" style={{ fontSize: '10px' }}>
                  NEW
                </span>
              )}
              <span className={getPriorityBadgeClass(row.PRIORITY_LEVEL || 'MEDIUM')} style={{ fontSize: '10px' }}>
                {row.PRIORITY_LEVEL || 'MEDIUM'}
              </span>
              {dueDateStatus && (
                <span className={`badge ${dueDateStatus.class} bg-transparent border border-warning`} style={{ fontSize: '10px' }}>
                  {dueDateStatus.text}
                </span>
              )}
              {row._userResponse && (
                <span className="badge bg-success" style={{ fontSize: '10px' }}>
                  RESPONDED
                </span>
              )}
            </div>
          </div>
        );
      }
    },
    {
      name: 'Notice Name',
      selector: row => row.NOTICE_TYPE,
      sortable: true,
      width: '130px',
      cell: row => (
        <span className="badge bg-secondary">
          {row.NOTICE_TYPE}
        </span>
      )
    },
    {
      name: 'Issued By',
      selector: row => row.ISSUED_BY_USER ? `${row.ISSUED_BY_USER.FIRST_NAME} ${row.ISSUED_BY_USER.LAST_NAME}` : 'Unknown',
      sortable: true,
      width: '150px',
      cell: row => (
        <div style={{ fontSize: '13px' }}>
          {row.ISSUED_BY_USER ? 
            `${row.ISSUED_BY_USER.FIRST_NAME} ${row.ISSUED_BY_USER.LAST_NAME}` : 
            'Unknown'
          }
        </div>
      )
    },
    {
      name: 'Issued Date',
      selector: row => row.ISSUE_DATE || '',
      sortable: true,
      width: '120px',
      cell: row => (
        <div style={{ fontSize: '13px' }}>
          {formatDate(row.ISSUE_DATE)}
        </div>
      )
    },
    {
      name: 'Status',
      selector: row => row.STATUS,
      sortable: true,
      width: '100px',
      cell: row => {
        const badgeColor = noticeService.getStatusBadgeColor(row.STATUS);
        return (
          <span className={`badge bg-${badgeColor}`} style={{ fontSize: '11px' }}>
            {row.STATUS}
          </span>
        );
      }
    },
    {
      name: 'Due Date',
      selector: row => row.DUE_DATE || '',
      sortable: true,
      width: '120px',
      cell: row => {
        if (!row.DUE_DATE) {
          return <div style={{ fontSize: '13px', color: '#6c757d' }}>No due date</div>;
        }
        
        const dueDateStatus = getDueDateStatus(row.DUE_DATE);
        const formattedDate = formatDate(row.DUE_DATE);
        
        return (
          <div style={{ fontSize: '13px' }}>
            <div className={dueDateStatus ? dueDateStatus.class : ''}>
              {formattedDate}
            </div>
            {dueDateStatus && (
              <div className="mt-1">
                <span className={`badge ${dueDateStatus.status === 'overdue' ? 'bg-danger' : dueDateStatus.status === 'urgent' ? 'bg-warning text-dark' : 'bg-info'}`} style={{ fontSize: '10px' }}>
                  {dueDateStatus.text}
                </span>
              </div>
            )}
          </div>
        );
      }
    },
    {
      name: 'Actions',
      width: '100px',
      cell: row => (
        <div className="d-flex gap-2">
          <button
            className="btn btn-sm btn-outline-primary"
            onClick={(e) => {
              e.stopPropagation();
              handleNoticeClick(row);
            }}
            title="View Notice"
          >
            <Eye size={14} />
          </button>
        </div>
      ),
      ignoreRowClick: true,
      sortable: false,
      selector: _ => ''
    }
  ];

  return (
    <div className="container">
      <h1 className="font-display font-bold text-[28px] text-[#032424] mb-6">Notices</h1>
      
      {/* Tab Navigation */}
      <div className="mb-4">
        <ul className="nav nav-tabs">
          <li className="nav-item">
            <button 
              className={`nav-link ${activeTab === 'my-notices' ? 'active' : ''}`}
              onClick={() => setActiveTab('my-notices')}
            >
              <Bell size={16} className="me-2" />
              My Notices
            </button>
          </li>
          {hasAllNoticesAccess && (
            <li className="nav-item">
              <button 
                className={`nav-link ${activeTab === 'all-notices' ? 'active' : ''}`}
                onClick={() => setActiveTab('all-notices')}
              >
                <Users size={16} className="me-2" />
                All Notices
              </button>
            </li>
          )}
        </ul>
      </div>

      {/* Section Header */}
      <div className="mb-3">
        <div className="d-flex align-items-center">
          <div className="bg-[#2EBCBC]" style={{ width: '4px', height: '20px', marginRight: '12px' }}></div>
          <div>
            <h3 className="font-display font-semibold text-[20px] text-[#032424] mb-0.5">
              {activeTab === 'my-notices' ? 'My Notices' : 'All Notices'}
            </h3>
            <p className="text-[13px] text-[#888888] mb-0">
              {activeTab === 'my-notices' 
                ? 'Notices issued to you by your organization'
                : 'All notices within your organization (management view)'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="request-dashboard-header mb-3 d-flex align-items-center justify-content-between">
        <div className="d-flex align-items-center gap-2">
          {/* Refresh Button */}
          <button
            className="border border-[#e8eaed] text-[#555555] hover:border-[#2EBCBC]/50 rounded-[10px] px-4 py-2 text-[13px] font-medium transition-colors inline-flex items-center gap-1.5"
            style={{ minWidth: 100 }}
            onClick={() => {
              setLoading(true);
              loadNotices();
            }}
            disabled={loading}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-arrow-clockwise me-1" viewBox="0 0 16 16">
              <path fillRule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z" />
              <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z" />
            </svg>
            Refresh
          </button>

          {/* New Notice Button */}
          {hasCreateNoticeAccess && (
            <button 
              className="bg-[#032424] text-white hover:bg-[#064a4a] rounded-[10px] px-4 py-2 text-[13px] font-semibold transition-colors d-flex align-items-center"
              style={{ minWidth: 140 }}
              onClick={() => setShowCreateModal(true)}
            >
              <Plus size={16} className="me-1" />
              New Notice
            </button>
          )}

          {/* Filter Toggle */}
          <button
            className="border border-[#e8eaed] text-[#555555] hover:border-[#2EBCBC]/50 rounded-[10px] px-4 py-2 text-[13px] font-medium transition-colors d-flex align-items-center"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={16} className="me-1" />
            Filters
          </button>
        </div>
        
        {/* Search Input */}
        <div className="d-flex align-items-center">
          <div className="position-relative">
            <Search size={16} className="position-absolute" style={{ left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#6c757d' }} />
            <input
              type="text"
              className="border-[1.5px] border-[#e8eaed] rounded-[10px] px-3.5 py-2 text-[14px] text-[#032424] placeholder:text-[#aaaaaa] focus:border-[#2EBCBC] focus:ring-[3px] focus:ring-[#2EBCBC]/10 outline-none transition-all"
              style={{ maxWidth: 260, paddingLeft: '32px' }}
              placeholder="Search notices..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="card mb-3">
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-3">
                <label className="form-label">Status</label>
                <select
                  className="border-[1.5px] border-[#e8eaed] rounded-[10px] px-3 py-2 text-[14px] text-[#032424] focus:border-[#2EBCBC] focus:ring-[3px] focus:ring-[#2EBCBC]/10 outline-none transition-all bg-white"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All Status</option>
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
              
              <div className="col-md-3">
                <label className="form-label">Notice Type</label>
                <select
                  className="border-[1.5px] border-[#e8eaed] rounded-[10px] px-3 py-2 text-[14px] text-[#032424] focus:border-[#2EBCBC] focus:ring-[3px] focus:ring-[#2EBCBC]/10 outline-none transition-all bg-white"
                  value={noticeTypeFilter}
                  onChange={(e) => setNoticeTypeFilter(e.target.value)}
                >
                  <option value="">All Types</option>
                  <option value="GENERAL">General</option>
                  <option value="URGENT">Urgent</option>
                  <option value="POLICY">Policy</option>
                  <option value="MAINTENANCE">Maintenance</option>
                </select>
              </div>
              
              <div className="col-md-2">
                <label className="form-label">Date From</label>
                <input
                  type="date"
                  className="border-[1.5px] border-[#e8eaed] rounded-[10px] px-3.5 py-2 text-[14px] text-[#032424] focus:border-[#2EBCBC] focus:ring-[3px] focus:ring-[#2EBCBC]/10 outline-none transition-all"
                  value={dateFromFilter}
                  onChange={(e) => setDateFromFilter(e.target.value)}
                />
              </div>
              
              <div className="col-md-2">
                <label className="form-label">Date To</label>
                <input
                  type="date"
                  className="border-[1.5px] border-[#e8eaed] rounded-[10px] px-3.5 py-2 text-[14px] text-[#032424] focus:border-[#2EBCBC] focus:ring-[3px] focus:ring-[#2EBCBC]/10 outline-none transition-all"
                  value={dateToFilter}
                  onChange={(e) => setDateToFilter(e.target.value)}
                />
              </div>
              
              <div className="col-md-2">
                <label className="form-label">&nbsp;</label>
                <div className="d-flex flex-column gap-2">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="unreadOnly"
                      checked={unreadOnlyFilter}
                      onChange={(e) => setUnreadOnlyFilter(e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="unreadOnly">
                      Unread Only
                    </label>
                  </div>
                  <button
                    className="border border-[#e8eaed] text-[#555555] hover:border-[#2EBCBC]/50 rounded-[10px] px-4 py-1.5 text-[13px] font-medium transition-colors"
                    onClick={clearFilters}
                  >
                    Clear All
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-[#fef2f2] text-[#991b1b] border border-red-200 rounded-[10px] p-3 text-[13px]" role="alert">
          {error}
        </div>
      )}

      {/* Notices Table */}
      <DataTable
        columns={columns}
        data={filteredNotices}
        pagination
        progressPending={loading}
        persistTableHead
        highlightOnHover
        pointerOnHover
        onRowClicked={handleNoticeClick}
        responsive
        striped
        defaultSortFieldId={5} // Sort by Issued Date
        defaultSortAsc={false} // DESC order
        customStyles={{
          table: {
            style: {
              width: '100%',
            },
          },
          cells: {
            style: {
              paddingLeft: '8px',
              paddingRight: '8px',
              overflow: 'visible',
              whiteSpace: 'normal',
            },
          },
          headCells: {
            style: {
              paddingLeft: '8px',
              paddingRight: '8px',
              fontWeight: 'bold',
              backgroundColor: '#f8f9fa',
            },
          },
          rows: {
            style: {
              cursor: 'pointer',
              '&:hover': {
                backgroundColor: '#f8f9fa',
              },
            },
          },
        }}
        noDataComponent={
          <div className="p-4 text-center">
            {error ? (
              <div className="text-danger">{error}</div>
            ) : loading ? (
              <div className="text-muted">Loading notices...</div>
            ) : (
              <div className="text-muted">
                {searchTerm || statusFilter || noticeTypeFilter || unreadOnlyFilter || dateFromFilter || dateToFilter
                  ? 'No notices match your current filters.'
                  : 'No notices found.'
                }
              </div>
            )}
          </div>
        }
      />

      {/* Create Notice Modal */}
      <CreateNoticeModal
        show={showCreateModal}
        onHide={() => setShowCreateModal(false)}
        onNoticeCreated={handleNoticeCreated}
      />
    </div>
  );
};

export default NoticesLandingPage;