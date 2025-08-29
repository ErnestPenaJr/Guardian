import React, { useMemo } from 'react';
import { Users, Search } from 'lucide-react';

interface User {
  USER_ID: number;
  EMAIL: string;
  FIRST_NAME: string;
  LAST_NAME: string;
  STATUS: string;
}

interface UserSelectionListProps {
  availableUsers: User[];
  assignedUserIds: number[];
  selectedUsers: number[];
  onUserSelectionChange: (userId: number, isSelected: boolean) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
}

export const UserSelectionList: React.FC<UserSelectionListProps> = ({
  availableUsers = [],
  assignedUserIds = [],
  selectedUsers = [],
  onUserSelectionChange,
  searchQuery = '',
  onSearchQueryChange
}) => {
  console.log('🔍 [UserSelectionList] Rendering with', availableUsers?.length, 'available users');

  // Filter users: exclude already assigned users and apply search
  const filteredUsers = useMemo(() => {
    // Ensure availableUsers is an array
    const users = Array.isArray(availableUsers) ? availableUsers : [];
    const assigned = Array.isArray(assignedUserIds) ? assignedUserIds : [];
    
    const filtered = users
      .filter(user => !assigned.includes(user.USER_ID))
      .filter(user => {
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase();
        return (
          user.FIRST_NAME.toLowerCase().includes(query) ||
          user.LAST_NAME.toLowerCase().includes(query) ||
          user.EMAIL.toLowerCase().includes(query)
        );
      });
      
    console.log('🔍 [UserSelectionList] Filtered to', filtered.length, 'users after removing assigned and applying search');
    return filtered;
  }, [availableUsers, assignedUserIds, searchQuery]);

  const handleSelectAll = () => {
    const allUserIds = filteredUsers.map(user => user.USER_ID);
    const selected = Array.isArray(selectedUsers) ? selectedUsers : [];
    const areAllSelected = allUserIds.every(id => selected.includes(id));
    
    allUserIds.forEach(userId => {
      onUserSelectionChange(userId, !areAllSelected);
    });
  };

  const selected = Array.isArray(selectedUsers) ? selectedUsers : [];
  const allFilteredSelected = filteredUsers.length > 0 && 
    filteredUsers.every(user => selected.includes(user.USER_ID));

  // Ensure availableUsers is an array before checking length
  const users = Array.isArray(availableUsers) ? availableUsers : [];
  if (users.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        <Users className="mx-auto h-8 w-8 text-gray-400 mb-2" />
        <p>No available users found</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search users..."
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
        />
      </div>

      {/* Select All Option */}
      {filteredUsers.length > 0 && (
        <div className="border-b border-gray-200 pb-2">
          <label className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
            <input
              type="checkbox"
              checked={allFilteredSelected}
              onChange={handleSelectAll}
              className="rounded border-gray-300 text-teal-600 shadow-sm focus:border-teal-300 focus:ring focus:ring-teal-200 focus:ring-opacity-50 mr-3"
            />
            <span className="text-sm font-medium text-gray-700">
              Select All ({filteredUsers.length})
            </span>
          </label>
        </div>
      )}

      {/* User List */}
      <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md">
        {filteredUsers.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <p className="text-sm">
              {searchQuery ? `No users found matching "${searchQuery}"` : 'All users are already assigned'}
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filteredUsers.map((user) => (
              <label
                key={user.USER_ID}
                className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(user.USER_ID)}
                  onChange={(e) => onUserSelectionChange(user.USER_ID, e.target.checked)}
                  className="rounded border-gray-300 text-teal-600 shadow-sm focus:border-teal-300 focus:ring focus:ring-teal-200 focus:ring-opacity-50 mr-3"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {user.FIRST_NAME} {user.LAST_NAME}
                  </p>
                  <p className="text-xs text-gray-600">{user.EMAIL}</p>
                </div>
                <div className="flex-shrink-0">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    user.STATUS === 'ACTIVE' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {user.STATUS}
                  </span>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Selection Summary */}
      <div className="text-sm text-gray-600 text-center">
        {selected.length} user{selected.length !== 1 ? 's' : ''} selected
        {filteredUsers.length > 0 && ` out of ${filteredUsers.length} available`}
      </div>
    </div>
  );
};