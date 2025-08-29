import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Users, Building2, X, UserPlus, UserMinus } from 'lucide-react';
import { useWorkspaceManagement } from '../hooks/useWorkspaceManagement';
import { ConfirmationDialog } from './workspace/ConfirmationDialog';
import { UserSelectionList } from './workspace/UserSelectionList';

interface Workspace {
  WORKSPACE_ID: number;
  WORKSPACE_NAME: string;
  DESCRIPTION?: string;
  COMPANY_ID: number;
  IS_ACTIVE: boolean;
  IS_DEFAULT: boolean;
  CREATE_DATE: string;
  UPDATE_DATE: string;
  USER_COUNT: number;
}

interface User {
  USER_ID: number;
  EMAIL: string;
  FIRST_NAME: string;
  LAST_NAME: string;
  STATUS: string;
  IS_ASSIGNED: boolean;
  IS_DEFAULT_WORKSPACE: boolean;
  ASSIGNED_DATE?: string;
}

interface AvailableUser {
  USER_ID: number;
  EMAIL: string;
  FIRST_NAME: string;
  LAST_NAME: string;
  STATUS: string;
}

export default function WorkspaceManagement() {
  const {
    workspaces,
    selectedWorkspace,
    workspaceUsers,
    availableUsers,
    loading,
    formData,
    setSelectedWorkspace,
    setFormData,
    fetchWorkspaceUsers,
    fetchAvailableUsers,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    addUsersToWorkspace,
    removeUserFromWorkspace,
    resetForm,
    setFormDataFromWorkspace,
  } = useWorkspaceManagement();

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [showAddUsersModal, setShowAddUsersModal] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [userToRemove, setUserToRemove] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal handlers with enhanced UX
  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await createWorkspace(formData);
    if (success) {
      setShowCreateModal(false);
      resetForm();
    }
  };

  const handleUpdateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkspace) return;
    
    const success = await updateWorkspace(selectedWorkspace, formData);
    if (success) {
      setShowEditModal(false);
      setSelectedWorkspace(null);
      resetForm();
    }
  };

  const handleDeleteConfirm = async () => {
    if (!userToRemove) return;
    const success = await deleteWorkspace(userToRemove);
    if (success) {
      setUserToRemove(null);
    }
  };

  // Enhanced modal handlers
  const openEditModal = (workspace: Workspace) => {
    setSelectedWorkspace(workspace);
    setFormDataFromWorkspace(workspace);
    setShowEditModal(true);
  };

  const handleAddUsers = async () => {
    if (!selectedWorkspace) return;
    
    const success = await addUsersToWorkspace(selectedWorkspace.WORKSPACE_ID, selectedUsers);
    if (success) {
      setShowAddUsersModal(false);
      setSelectedUsers([]);
      setSearchQuery('');
    }
  };

  const handleRemoveUser = (user: User) => {
    setUserToRemove(user);
  };

  const handleRemoveUserConfirm = async () => {
    if (!selectedWorkspace || !userToRemove) return;
    
    const success = await removeUserFromWorkspace(
      selectedWorkspace.WORKSPACE_ID, 
      userToRemove.USER_ID
    );
    if (success) {
      setUserToRemove(null);
    }
  };

  const handleUserSelectionChange = (userId: number, isSelected: boolean) => {
    setSelectedUsers(prev => 
      isSelected 
        ? [...prev, userId]
        : prev.filter(id => id !== userId)
    );
  };

  // Enhanced modal openers
  const openAddUsersModal = () => {
    console.log('🔍 [openAddUsersModal] Opening add users modal, fetching available users...');
    
    fetchAvailableUsers();
    setShowAddUsersModal(true);
    setSelectedUsers([]);
    setSearchQuery('');
  };

  const openUsersModal = (workspace: Workspace) => {
    setSelectedWorkspace(workspace);
    fetchWorkspaceUsers(workspace.WORKSPACE_ID);
    setShowUsersModal(true);
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Building2 className="h-8 w-8 text-teal-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Workspace Management</h1>
            <p className="text-gray-600">Manage workspaces and user assignments</p>
          </div>
        </div>
        
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
        >
          <Plus size={16} className="mr-2" />
          Create Workspace
        </button>
      </div>

      {/* Workspaces Grid */}
      {loading && workspaces.length === 0 ? (
        <div className="text-center py-12">
          <Building2 className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Loading workspaces...</h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((workspace) => (
            <div
              key={workspace.WORKSPACE_ID}
              className="bg-white overflow-hidden shadow rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <Building2 className="h-5 w-5 text-teal-500" />
                    <h3 className="text-lg font-medium text-gray-900 truncate">
                      {workspace.WORKSPACE_NAME}
                    </h3>
                    {workspace.IS_DEFAULT && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        Default
                      </span>
                    )}
                  </div>
                </div>

                {workspace.DESCRIPTION && (
                  <p className="text-sm text-gray-600 mb-4">
                    {workspace.DESCRIPTION}
                  </p>
                )}

                <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                  <div className="flex items-center space-x-1">
                    <Users size={14} />
                    <span>{workspace.USER_COUNT} user{workspace.USER_COUNT !== 1 ? 's' : ''}</span>
                  </div>
                  <span>
                    Created {new Date(workspace.CREATE_DATE).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => openUsersModal(workspace)}
                      className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
                    >
                      <Users size={14} className="mr-1" />
                      Users
                    </button>
                    
                    <button
                      onClick={() => openEditModal(workspace)}
                      className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
                    >
                      <Edit2 size={14} className="mr-1" />
                      Edit
                    </button>
                  </div>

                  {!workspace.IS_DEFAULT && workspace.USER_COUNT === 0 && (
                    <button
                      onClick={() => setUserToRemove(workspace as any)}
                      className="inline-flex items-center px-3 py-1.5 border border-red-300 shadow-sm text-xs font-medium rounded text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      <Trash2 size={14} className="mr-1" />
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Workspace Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Create New Workspace</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateWorkspace}>
              <div className="mb-4">
                <label htmlFor="workspaceName" className="block text-sm font-medium text-gray-700 mb-2">
                  Workspace Name *
                </label>
                <input
                  type="text"
                  id="workspaceName"
                  value={formData.workspaceName}
                  onChange={(e) => setFormData({ ...formData, workspaceName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500"
                  placeholder="Enter workspace name"
                  required
                />
              </div>

              <div className="mb-4">
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500"
                  placeholder="Enter workspace description"
                  rows={3}
                />
              </div>

              <div className="mb-6">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.isDefault}
                    onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                    className="rounded border-gray-300 text-teal-600 shadow-sm focus:border-teal-300 focus:ring focus:ring-teal-200 focus:ring-opacity-50"
                  />
                  <span className="ml-2 text-sm text-gray-700">Set as default workspace</span>
                </label>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Workspace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Workspace Modal */}
      {showEditModal && selectedWorkspace && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Edit Workspace</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateWorkspace}>
              <div className="mb-4">
                <label htmlFor="editWorkspaceName" className="block text-sm font-medium text-gray-700 mb-2">
                  Workspace Name *
                </label>
                <input
                  type="text"
                  id="editWorkspaceName"
                  value={formData.workspaceName}
                  onChange={(e) => setFormData({ ...formData, workspaceName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500"
                  placeholder="Enter workspace name"
                  required
                />
              </div>

              <div className="mb-4">
                <label htmlFor="editDescription" className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  id="editDescription"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500"
                  placeholder="Enter workspace description"
                  rows={3}
                />
              </div>

              <div className="mb-6">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.isDefault}
                    onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                    className="rounded border-gray-300 text-teal-600 shadow-sm focus:border-teal-300 focus:ring focus:ring-teal-200 focus:ring-opacity-50"
                  />
                  <span className="ml-2 text-sm text-gray-700">Set as default workspace</span>
                </label>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50"
                >
                  {loading ? 'Updating...' : 'Update Workspace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Users Modal */}
      {showUsersModal && selectedWorkspace && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-2/3 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Users in {selectedWorkspace.WORKSPACE_NAME}
              </h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={openAddUsersModal}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
                >
                  <UserPlus size={14} className="mr-1" />
                  Add Users
                </button>
                <button
                  onClick={() => setShowUsersModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {workspaceUsers.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No users assigned</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    This workspace doesn't have any users assigned yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {workspaceUsers.map((user) => (
                    <div
                      key={user.USER_ID}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {user.FIRST_NAME} {user.LAST_NAME}
                        </p>
                        <p className="text-sm text-gray-600">{user.EMAIL}</p>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="text-right">
                          {user.IS_DEFAULT_WORKSPACE && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 mb-1">
                              Default Workspace
                            </span>
                          )}
                          {user.ASSIGNED_DATE && (
                            <p className="text-xs text-gray-500">
                              Assigned {new Date(user.ASSIGNED_DATE).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => handleRemoveUser(user)}
                          disabled={loading}
                          className="inline-flex items-center px-2 py-1 border border-red-300 shadow-sm text-xs font-medium rounded text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                        >
                          <UserMinus size={12} className="mr-1" />
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Users Modal */}
      {showAddUsersModal && selectedWorkspace && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-1/2 max-w-2xl shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Add Users to {selectedWorkspace.WORKSPACE_NAME}
              </h3>
              <button
                onClick={() => {
                  setShowAddUsersModal(false);
                  setSelectedUsers([]);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Select Users to Add:
              </label>
              <UserSelectionList
                availableUsers={availableUsers}
                assignedUserIds={workspaceUsers.map(u => u.USER_ID)}
                selectedUsers={selectedUsers}
                onUserSelectionChange={handleUserSelectionChange}
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowAddUsersModal(false);
                  setSelectedUsers([]);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
              >
                Cancel
              </button>
              <button
                onClick={handleAddUsers}
                disabled={loading || selectedUsers.length === 0}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50"
              >
                {loading ? 'Adding...' : `Add ${selectedUsers.length} User${selectedUsers.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialogs */}
      <ConfirmationDialog
        isOpen={!!userToRemove && 'WORKSPACE_ID' in (userToRemove as any)}
        onClose={() => setUserToRemove(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Workspace"
        message={`Are you sure you want to delete the workspace "${(userToRemove as any)?.WORKSPACE_NAME}"? This action cannot be undone.`}
        confirmText="Delete Workspace"
        variant="danger"
        loading={loading}
      />

      <ConfirmationDialog
        isOpen={!!userToRemove && !('WORKSPACE_ID' in (userToRemove as any))}
        onClose={() => setUserToRemove(null)}
        onConfirm={handleRemoveUserConfirm}
        title="Remove User"
        message={`Are you sure you want to remove ${userToRemove?.FIRST_NAME} ${userToRemove?.LAST_NAME} from this workspace?`}
        confirmText="Remove User"
        variant="warning"
        loading={loading}
      />
    </div>
  );
}