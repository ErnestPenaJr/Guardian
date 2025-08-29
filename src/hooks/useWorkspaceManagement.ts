import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import api from '../utils/api';

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

interface FormData {
  workspaceName: string;
  description: string;
  isDefault: boolean;
}

export const useWorkspaceManagement = () => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [workspaceUsers, setWorkspaceUsers] = useState<User[]>([]);
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    workspaceName: '',
    description: '',
    isDefault: false
  });

  // API call helper using centralized api utility
  const apiCall = useCallback(async (url: string, method: string = 'GET', data?: any) => {
    const response = await api({
      url,
      method,
      data,
    });
    return response.data;
  }, []);

  // Fetch workspaces with optimistic updates
  const fetchWorkspaces = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiCall('/api/workspaces');
      setWorkspaces(data.workspaces || []);
    } catch (error) {
      console.error('Error fetching workspaces:', error);
      toast.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  // Fetch users for a workspace
  const fetchWorkspaceUsers = useCallback(async (workspaceId: number) => {
    try {
      const data = await apiCall(`/api/workspaces/${workspaceId}/users`);
      setWorkspaceUsers(data.users || []);
    } catch (error) {
      console.error('Error fetching workspace users:', error);
      toast.error((error as Error).message);
    }
  }, [apiCall]);

  // Fetch available users for assignment
  const fetchAvailableUsers = useCallback(async () => {
    try {
      console.log('🔍 [fetchAvailableUsers] Fetching available users...');
      
      const data = await apiCall('/api/users');
      console.log('🔍 [fetchAvailableUsers] API response:', { 
        success: data.success, 
        dataLength: data.data?.length, 
        count: data.count 
      });
      
      // Fix: The server returns { success: true, data: [...users...], count: n }
      // Previously we were looking for data.users, but it should be data.data
      const users = data.data || data.users || data;
      
      if (Array.isArray(users) && users.length > 0) {
        console.log(`✅ [fetchAvailableUsers] Successfully loaded ${users.length} users`);
        setAvailableUsers(users);
      } else {
        console.log('⚠️ [fetchAvailableUsers] No users found or invalid response format');
        setAvailableUsers([]);
      }
    } catch (error) {
      console.error('❌ [fetchAvailableUsers] Error:', error);
      setAvailableUsers([]);
      toast.error((error as Error).message);
    }
  }, [apiCall]);

  // Create workspace
  const createWorkspace = useCallback(async (data: FormData) => {
    if (!data.workspaceName.trim()) {
      toast.error('Workspace name is required');
      return false;
    }

    try {
      setLoading(true);
      await apiCall('/api/workspaces', 'POST', data);
      
      toast.success('Workspace created successfully');
      fetchWorkspaces();
      return true;
    } catch (error) {
      console.error('Error creating workspace:', error);
      toast.error((error as Error).message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [apiCall, fetchWorkspaces]);

  // Update workspace
  const updateWorkspace = useCallback(async (workspace: Workspace, data: FormData) => {
    if (!data.workspaceName.trim()) {
      toast.error('Workspace name is required');
      return false;
    }

    try {
      setLoading(true);
      await apiCall(`/api/workspaces/${workspace.WORKSPACE_ID}`, 'PUT', data);

      toast.success('Workspace updated successfully');
      fetchWorkspaces();
      return true;
    } catch (error) {
      console.error('Error updating workspace:', error);
      toast.error((error as Error).message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [apiCall, fetchWorkspaces]);

  // Delete workspace with validation
  const deleteWorkspace = useCallback(async (workspace: Workspace) => {
    if (workspace.IS_DEFAULT) {
      toast.error('Cannot delete the default workspace');
      return false;
    }

    if (workspace.USER_COUNT > 0) {
      toast.error('Cannot delete workspace with assigned users');
      return false;
    }

    try {
      setLoading(true);
      await apiCall(`/api/workspaces/${workspace.WORKSPACE_ID}`, 'DELETE');

      toast.success('Workspace deleted successfully');
      fetchWorkspaces();
      return true;
    } catch (error) {
      console.error('Error deleting workspace:', error);
      toast.error((error as Error).message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [apiCall, fetchWorkspaces]);

  // Add users to workspace
  const addUsersToWorkspace = useCallback(async (workspaceId: number, userIds: number[]) => {
    if (userIds.length === 0) {
      toast.error('Please select at least one user');
      return false;
    }

    try {
      setLoading(true);
      const result = await apiCall(`/api/workspaces/${workspaceId}/users`, 'POST', {
        userIds,
        isDefault: false
      });

      toast.success(result.message || 'Users added successfully');
      fetchWorkspaceUsers(workspaceId);
      fetchWorkspaces();
      return true;
    } catch (error) {
      console.error('Error adding users:', error);
      toast.error((error as Error).message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [apiCall, fetchWorkspaceUsers, fetchWorkspaces]);

  // Remove user from workspace
  const removeUserFromWorkspace = useCallback(async (workspaceId: number, userId: number) => {
    try {
      setLoading(true);
      await apiCall(`/api/workspaces/${workspaceId}/users/${userId}`, 'DELETE');

      toast.success('User removed successfully');
      fetchWorkspaceUsers(workspaceId);
      fetchWorkspaces();
      return true;
    } catch (error) {
      console.error('Error removing user:', error);
      toast.error((error as Error).message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [apiCall, fetchWorkspaceUsers, fetchWorkspaces]);

  // Reset form data
  const resetForm = useCallback(() => {
    setFormData({
      workspaceName: '',
      description: '',
      isDefault: false
    });
  }, []);

  // Set form data from workspace
  const setFormDataFromWorkspace = useCallback((workspace: Workspace) => {
    setFormData({
      workspaceName: workspace.WORKSPACE_NAME,
      description: workspace.DESCRIPTION || '',
      isDefault: workspace.IS_DEFAULT
    });
  }, []);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  return {
    // State
    workspaces,
    selectedWorkspace,
    workspaceUsers,
    availableUsers,
    loading,
    formData,
    
    // Actions
    setSelectedWorkspace,
    setFormData,
    fetchWorkspaces,
    fetchWorkspaceUsers,
    fetchAvailableUsers,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    addUsersToWorkspace,
    removeUserFromWorkspace,
    resetForm,
    setFormDataFromWorkspace,
  };
};