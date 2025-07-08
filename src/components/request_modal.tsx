import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../utils/api';

interface RequestModalProps {
  show: boolean;
  onClose: () => void;
  request: any; // Replace with proper type if available
}

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  createdAt: string;
  companyId: number;
  roles: any[];
}

const RequestModal: React.FC<RequestModalProps> = ({ show, onClose, request }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (request) {
      setLoading(true);
      setError('');
      // Fetch users
      api.get('/api/users')
        .then(response => {
          if (response.data && response.data.data && Array.isArray(response.data.data)) {
            setUsers(response.data.data);
            // If the request already has an assigned user, select it
            if (request.ASSIGNED_ID) {
              setSelectedUser(request.ASSIGNED_ID);
            }
          } else {
            console.error('Invalid users data:', response.data);
            setError('Failed to load users: invalid data format');
            setUsers([]);
          }
        })
        .catch(err => {
          console.error('Error fetching users:', err);
          if (err.response?.status === 401) {
            // Token expired or invalid, redirect to login
            window.location.href = '/login';
            return;
          }
          setError('Failed to load users. Please try again.');
          setUsers([]);
        })
        .finally(() => setLoading(false));
    }
  }, [request]);

  const handleAssignUser = () => {
    if (!selectedUser) return;
    
    setLoading(true);
    setError('');
    
    api.post(`/api/requests/${request.REQUEST_ID}/assign`, { assignedId: selectedUser })
      .then(({ data }) => {
        console.log('User assigned successfully:', data);
        // Show success message and close modal
        toast.success('User assigned successfully');
        onClose();
      })
      .catch((err: Error) => {
        console.error('Error assigning user:', err);
        setError('Failed to assign user. Please try again.');
        toast.error('Failed to assign user');
      })
      .finally(() => setLoading(false));
  };

  if (!show) return null;

  // Format date string to readable format
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get status text and badge color from status code
  const getStatusInfo = (statusCode: string) => {
    const statusMap: {[key: string]: {text: string, color: string}} = {
      'P': {text: 'In Progress', color: 'bg-blue-100 text-blue-800'},
      'A': {text: 'Approved', color: 'bg-green-100 text-green-800'},
      'R': {text: 'Rejected', color: 'bg-red-100 text-red-800'},
      'C': {text: 'Completed', color: 'bg-purple-100 text-purple-800'},
      'N': {text: 'New', color: 'bg-yellow-100 text-yellow-800'},
      'X': {text: 'Cancelled', color: 'bg-gray-100 text-gray-800'}
    };
    return statusMap[statusCode] || {text: 'Unknown', color: 'bg-gray-100 text-gray-800'};
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center overflow-x-hidden overflow-y-auto outline-none focus:outline-none bg-black bg-opacity-50"
      onClick={(e) => {
        // Close modal when clicking outside
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-2xl mx-auto my-6">
        {/* Modal content */}
        <div className="relative flex flex-col w-full bg-white border-0 rounded-lg shadow-lg outline-none focus:outline-none">
          {/* Header with tracking ID and close button */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 rounded-t bg-gray-50">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center">
              <span className="mr-2">📋</span>
              Request Details - {request.TRACKINGID || 'N/A'}
            </h3>
            <button
              className="p-1 ml-auto bg-transparent border-0 text-gray-400 hover:text-gray-500 float-right text-3xl leading-none font-semibold outline-none focus:outline-none"
              onClick={onClose}
              aria-label="Close"
            >
              <span className="text-gray-500 h-6 w-6 text-2xl block">&times;</span>
            </button>
          </div>
          
          {/* Body with request details */}
          <div className="relative p-5 flex-auto">
            {/* Error message */}
            {error && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded flex items-center">
                <span className="mr-2">⚠️</span>
                {error}
              </div>
            )}
            
            {/* Main content section */}
            <div className="space-y-6">
              {/* Request and User Information in two columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left column: Request Information */}
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                  <h4 className="font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-100 flex items-center">
                    <span className="mr-2">📝</span>Request Information
                  </h4>
                  <div className="space-y-3">
                    <div className="flex flex-col">
                      <span className="text-sm text-gray-500">Request ID</span>
                      <span className="font-medium">{request.REQUEST_ID}</span>
                    </div>
                    
                    <div className="flex flex-col">
                      <span className="text-sm text-gray-500">Tracking ID</span>
                      <span className="font-medium">{request.TRACKINGID || 'N/A'}</span>
                    </div>
                    
                    <div className="flex flex-col">
                      <span className="text-sm text-gray-500">Request Name</span>
                      <span className="font-medium">{request.REQUEST_NAME}</span>
                    </div>
                    
                    <div className="flex flex-col">
                      <span className="text-sm text-gray-500">Status</span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusInfo(request.STATUS).color}`}>
                        {getStatusInfo(request.STATUS).text}
                      </span>
                    </div>
                    
                    <div className="flex flex-col">
                      <span className="text-sm text-gray-500">Created</span>
                      <span className="font-medium">{formatDate(request.CREATE_DATE)}</span>
                    </div>
                    
                    <div className="flex flex-col">
                      <span className="text-sm text-gray-500">Updated</span>
                      <span className="font-medium">{formatDate(request.UPDATE_DATE)}</span>
                    </div>
                  </div>
                </div>
                
                {/* Right column: User Information */}
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                  <h4 className="font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-100 flex items-center">
                    <span className="mr-2">👤</span>User Information
                  </h4>
                  <div className="space-y-3 mb-4">
                    <div className="flex flex-col">
                      <span className="text-sm text-gray-500">Requestor</span>
                      <span className="font-medium">{request.requestorName || 'N/A'}</span>
                    </div>
                    
                    <div className="flex flex-col">
                      <span className="text-sm text-gray-500">Assigned To</span>
                      <span className="font-medium">
                        {request.assignedName || 
                          <span className="text-yellow-600 font-medium">Unassigned</span>}
                      </span>
                    </div>
                    
                    <div className="flex flex-col">
                      <span className="text-sm text-gray-500">External User</span>
                      <span className="font-medium">{request.EXTERNAL_USER || 'N/A'}</span>
                    </div>
                  </div>
                  
                  {/* User assignment section */}
                  <div className="mt-5 pt-3 border-t border-gray-100">
                    <label htmlFor="assignUser" className="block text-sm font-medium text-gray-700 mb-2">
                      Assign to User
                    </label>
                    <select
                      id="assignUser"
                      className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={selectedUser || ''}
                      onChange={(e) => setSelectedUser(e.target.value ? parseInt(e.target.value) : null)}
                      disabled={loading}
                    >
                      <option value="">Select a user</option>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>
                          {user.firstName} {user.lastName} ({user.email})
                        </option>
                      ))}
                    </select>
                    {users.length === 0 && !loading && !error && (
                      <p className="text-sm text-gray-500 mt-1">No users available for assignment</p>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Full-width Description Section */}
              <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                <h4 className="font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-100 flex items-center">
                  <span className="mr-2">📄</span>Request Description
                </h4>
                {request.REQUEST_DESCRIPTION ? (
                  <div className="bg-gray-50 p-4 rounded-md border border-gray-100 max-h-48 overflow-y-auto whitespace-pre-wrap">
                    {request.REQUEST_DESCRIPTION}
                  </div>
                ) : (
                  <div className="p-4 text-gray-400 italic bg-gray-50 rounded-md border border-gray-100">
                    No description provided for this request.
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Footer with action buttons */}
          <div className="flex items-center justify-end p-4 border-t border-gray-200 rounded-b bg-gray-50">
            <button
              className="px-4 py-2 mr-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              type="button"
              onClick={onClose}
              disabled={loading}
            >
              Close
            </button>
            <button
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 flex items-center"
              type="button"
              onClick={handleAssignUser}
              disabled={!selectedUser || loading}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : (
                'Assign User'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RequestModal;
