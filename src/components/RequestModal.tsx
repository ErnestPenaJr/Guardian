import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'react-toastify';
import { Upload, MessageSquare, Play, CheckCircle, FileText, Send, Download, Save } from 'lucide-react';
import './RequestModal.css';

interface User {
  USER_ID: number;
  EMAIL: string;
  FIRST_NAME: string;
  LAST_NAME: string;
  FULL_NAME: string;
  COMPANY_ID: number;
  ROLE_NAMES: string;
}

interface Request {
  REQUEST_ID: number;
  REQUEST_NAME: string;
  STATUS: string;
  FORM_ID: number | null;
  REQUESTOR_ID: number | null;
  ASSIGNED_ID: number | null;
  SUBMITTED_DATE: string | null;
  CREATE_DATE: string | null;
  UPDATE_DATE: string | null;
  TRACKINGID: string | null;
  REQUEST_DESCRIPTION?: string | null;
  RESULTS_DESCRIPTION?: string | null;
  EXTERNAL_USER?: string | null;
  requestor?: {
    FIRST_NAME: string;
    LAST_NAME: string;
  };
  assigned?: {
    FIRST_NAME: string;
    LAST_NAME: string;
  };
  requestorName?: string;
  assignedName?: string;
}

interface FormFieldValue {
  fieldName: string;
  fieldValue: any;
}

interface Task {
  TASK_ID: number;
  DESCRIPTION: string;
  STATUS: string;
  ASSIGNED_USER_ID: number | null;
  REQUEST_ID: number;
  CREATE_DATE: string;
  UPDATE_DATE: string;
  assignedUser?: {
    FIRST_NAME: string;
    LAST_NAME: string;
    FULL_NAME: string;
  };
}

interface Attachment {
  attachmentId: number;
  requestId: number;
  fileName: string;
  createDate: string;
  uploadedBy: {
    userId: number;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface Props {
  request: Request;
  show: boolean;
  onHide: () => void;
  onUpdate: () => void;
}

const RequestModal: React.FC<Props> = ({ request, show, onHide, onUpdate }) => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [formFieldValues, setFormFieldValues] = useState<FormFieldValue[]>([]);
  const [formTemplate, setFormTemplate] = useState<any>(null);
  const [formLoading, setFormLoading] = useState<boolean>(false);
  const [isSavingForm, setIsSavingForm] = useState<boolean>(false);
  const [formHasChanges, setFormHasChanges] = useState<boolean>(false);
  
  // Work management state
  const [workActionLoading, setWorkActionLoading] = useState<boolean>(false);
  const [showWorkSection, setShowWorkSection] = useState<boolean>(false);
  const [feedbackText, setFeedbackText] = useState<string>('');
  const [feedbackFiles, setFeedbackFiles] = useState<File[]>([]);
  const [feedbackType, setFeedbackType] = useState<string>('update');
  const [activeWorkTab, setActiveWorkTab] = useState<'feedback' | 'files' | 'status'>('feedback');
  
  // Main tab state
  const [activeMainTab, setActiveMainTab] = useState<'details' | 'tasks' | 'results' | 'milestones'>('details');
  
  // Results tab state
  const [resultsNotes, setResultsNotes] = useState<string>('');
  const [attachments, setAttachments] = useState<any[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState<boolean>(false);
  const [savingResults, setSavingResults] = useState<boolean>(false);
  const [resultsHasChanges, setResultsHasChanges] = useState<boolean>(false);
  
  // Task management state
  const [tasks, setTasks] = useState<any[]>([]);
  const [tasksLoading, setTasksLoading] = useState<boolean>(false);
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set());
  const [showAddTaskModal, setShowAddTaskModal] = useState<boolean>(false);
  const [showAssignTaskModal, setShowAssignTaskModal] = useState<boolean>(false);
  const [taskActionLoading, setTaskActionLoading] = useState<boolean>(false);
  const [newTaskData, setNewTaskData] = useState<{
    assignedUserId: string;
    description: string;
  }>({
    assignedUserId: '',
    description: ''
  });
  const [assignTaskData, setAssignTaskData] = useState<{
    assignedUserId: string;
  }>({
    assignedUserId: ''
  });

  // Handle assign tasks
  const handleAssignTasks = async () => {
    if (!assignTaskData.assignedUserId) {
      toast.error('Please select a user to assign tasks to');
      return;
    }

    try {
      setTaskActionLoading(true);
      const taskIds = Array.from(selectedTasks);
      console.log('👤 Assigning tasks:', taskIds, 'to user:', assignTaskData.assignedUserId);

      // Call the existing handleTaskAssign function
      await handleTaskAssign(taskIds, assignTaskData.assignedUserId);
      
      // Close modal and reset data
      setShowAssignTaskModal(false);
      setAssignTaskData({ assignedUserId: '' });
      setSelectedTasks(new Set()); // Clear selection after assignment
      
    } catch (error: any) {
      console.error('❌ Error assigning tasks:', error);
      toast.error('Failed to assign tasks');
    } finally {
      setTaskActionLoading(false);
    }
  };
  
  // Check if current user can assign requests (processor and above)
  const canAssignRequests = () => {
    if (!currentUser) {
      console.log('❌ canAssignRequests: No current user');
      return false;
    }
    
    console.log('🔍 canAssignRequests: Current user:', currentUser);
    console.log('🔍 canAssignRequests: User properties:', Object.keys(currentUser));
    
    // Role IDs that can assign requests: Admin(1), User(2), Manager(3), Super Admin(6)
    const assignmentRoles = [1, 2, 3, 6];
    
    // Check if user has roles array (from login API response)
    if (currentUser.roles && Array.isArray(currentUser.roles)) {
      console.log('🔍 canAssignRequests: Checking roles array:', currentUser.roles);
      const hasPermission = currentUser.roles.some((role: any) => {
        const roleId = role.id;
        console.log(`🔍 canAssignRequests: Checking role ID ${roleId} against assignment roles:`, assignmentRoles);
        return assignmentRoles.includes(roleId);
      });
      console.log('🔍 canAssignRequests: Has permission from roles array:', hasPermission);
      return hasPermission;
    }
    
    // Check roleIds array (from login API response)
    if (currentUser.roleIds && Array.isArray(currentUser.roleIds)) {
      console.log('🔍 canAssignRequests: Checking roleIds array:', currentUser.roleIds);
      const hasPermission = currentUser.roleIds.some((roleId: number) => 
        assignmentRoles.includes(roleId)
      );
      console.log('🔍 canAssignRequests: Has permission from roleIds array:', hasPermission);
      return hasPermission;
    }
    
    // Check single role (fallback)
    if (currentUser.role) {
      console.log('🔍 canAssignRequests: Checking single role:', currentUser.role);
      const roleId = parseInt(currentUser.role, 10);
      const hasPermission = assignmentRoles.includes(roleId);
      console.log('🔍 canAssignRequests: Has permission from single role:', hasPermission);
      return hasPermission;
    }
    
    // Check if user has an ID property (assume user with ID 1111 is admin for now)
    if (currentUser.id || currentUser.userId) {
      const userId = currentUser.id || currentUser.userId;
      console.log('🔍 canAssignRequests: Found user ID:', userId);
      // For now, allow all logged-in users to assign (temporary fix)
      console.log('⚠️ canAssignRequests: No role info found, allowing all logged-in users (temporary)');
      return true;
    }
    
    console.log('❌ canAssignRequests: No valid role or user information found');
    return false;
  };

  // Memoized permission check to prevent dropdown from disappearing
  const hasAssignPermission = useMemo(() => {
    const permission = canAssignRequests();
    console.log('🔒 Memoized permission check result:', permission);
    return permission;
  }, [currentUser]);
  
  // Check if current user is assigned to this request
  const isAssignedToCurrentUser = useMemo(() => {
    return currentUser && request.ASSIGNED_ID === (currentUser.userId || currentUser.id);
  }, [currentUser, request.ASSIGNED_ID]);
  
  // Check if current user is the requestor
  const isRequestorUser = useMemo(() => {
    return currentUser && request.REQUESTOR_ID === (currentUser.userId || currentUser.id);
  }, [currentUser, request.REQUESTOR_ID]);
  
  // Check if user can work on this request (assigned user or admin)
  const canWorkOnRequest = useMemo(() => {
    if (!currentUser) return false;
    
    // If user is assigned to the request
    if (isAssignedToCurrentUser) return true;
    
    // If user is admin/manager (roles 1, 3, 6)
    const workRoles = [1, 3, 6];
    if (currentUser.roles && Array.isArray(currentUser.roles)) {
      return currentUser.roles.some((role: any) => workRoles.includes(role.id));
    }
    if (currentUser.roleIds && Array.isArray(currentUser.roleIds)) {
      return currentUser.roleIds.some((roleId: number) => workRoles.includes(roleId));
    }
    
    return false;
  }, [currentUser, isAssignedToCurrentUser]);
  
  // Get status display text
  const getStatusText = (status: string) => {
    switch(status) {
      case 'P': return 'Pending';
      case 'A': return 'Active';
      case 'C': return 'Completed';
      default: return 'Unknown';
    }
  };
  
  // Get status badge class
  const getStatusBadgeClass = (status: string) => {
    switch(status) {
      case 'P': return 'badge bg-warning text-dark';
      case 'A': return 'badge bg-primary text-white';
      case 'C': return 'badge bg-success text-white';
      default: return 'badge bg-secondary text-white';
    }
  };

  // Get form type from form ID or request name
  const getFormType = () => {
    if (request.FORM_ID) {
      // Map specific form IDs to types
      const formTypeMap: Record<number, string> = {
        1: 'subject verification',
        2: 'financial verification', 
        3: 'address verification',
        4: 'employment verification',
        5: 'bank test',
        6: 'identity verification'
      };
      return formTypeMap[request.FORM_ID] || 'verification';
    }
    return request.REQUEST_NAME?.toLowerCase() || 'general';
  };

  // Load users and form data when modal opens
  useEffect(() => {
    console.log('🔄 useEffect triggered - show:', show, 'request.REQUEST_ID:', request.REQUEST_ID);
    if (show) {
      console.log('🔄 Modal opened, checking permissions...');
      console.log('🔄 Current user in useEffect:', currentUser);
      console.log('🔄 Has assignment permission:', hasAssignPermission);
      
      // Reset form change tracking
      setFormHasChanges(false);
      
      // Only fetch users if current user can assign requests
      if (hasAssignPermission) {
        console.log('✅ User has assignment permission, fetching users...');
        fetchUsers();
      } else {
        console.log('❌ User does not have assignment permission, skipping user fetch');
        console.log('❌ Current user details:', currentUser);
        console.log('❌ This means the assignment dropdown will be empty!');
      }
      // Always try to fetch form data, tasks, and attachments
      fetchFormFieldValues();
      fetchTasks();
      fetchAttachments();
    } else {
      console.log('🔄 Modal is not shown, skipping data fetch');
    }
  }, [show, request.REQUEST_ID, hasAssignPermission]);

  // Initialize selected user with currently assigned user
  useEffect(() => {
    if (request && request.ASSIGNED_ID) {
      setSelectedUser(request.ASSIGNED_ID.toString());
    } else {
      setSelectedUser('');
    }
  }, [request]);

  // Initialize results notes from RESULTS_DESCRIPTION field
  useEffect(() => {
    if (request && request.RESULTS_DESCRIPTION) {
      setResultsNotes(request.RESULTS_DESCRIPTION);
      setResultsHasChanges(false);
    } else {
      setResultsNotes('');
      setResultsHasChanges(false);
    }
  }, [request.REQUEST_ID, request.RESULTS_DESCRIPTION]);

  // Fetch users for assignment dropdown (only processors)
  const fetchUsers = async () => {
    try {
      setLoading(true);
      console.log('🔄 Fetching users from /api/users...');
      const response = await api.get('/api/users');
      console.log('🔄 Raw API response:', response);
      const userData = response.data?.data || response.data;
      console.log('🔄 Extracted user data:', userData);
      
      if (Array.isArray(userData)) {
        console.log(`🔄 Processing ${userData.length} users for filtering...`);
        
        // Log first few users to see their structure
        if (userData.length > 0) {
          console.log('🔄 Sample user structure:', userData.slice(0, 2));
        }
        
        // Show all users for assignment (minimal filtering for debugging)
        // Users with role IDs 1,2,3,6 can assign to any user
        const allUsers = userData.filter((user: User) => {
          // Very basic validation - just check if user has an ID
          const hasId = user.USER_ID;
          const firstName = user.FIRST_NAME || 'No First Name';
          const lastName = user.LAST_NAME || 'No Last Name';
          console.log(`🔄 User ID: ${user.USER_ID}, Name: "${firstName} ${lastName}", Role: "${user.ROLE_NAMES}", Has ID: ${hasId}`);
          return hasId; // Only require USER_ID to exist
        });
        
        console.log(`🔄 Showing ${allUsers.length} users for assignment:`, allUsers.map(u => `${u.FIRST_NAME} ${u.LAST_NAME} (${u.ROLE_NAMES})`));
        
        // If no users after filtering, show all users as fallback for debugging
        if (allUsers.length === 0) {
          console.log('⚠️ No users passed filtering! Using all users as fallback...');
          setUsers(userData);
        } else {
          setUsers(allUsers);
        }
        
        console.log(`✅ Final user count in dropdown: ${allUsers.length > 0 ? allUsers.length : userData.length}`);
        console.log(`✅ Users set in state:`, allUsers.length > 0 ? allUsers : userData);
      } else {
        console.error('❌ User data is not an array:', userData);
      }
    } catch (err) {
      console.error('❌ Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch form field values for this request
  const fetchFormFieldValues = async () => {
    try {
      setFormLoading(true);
      console.log(`Fetching form data for request ${request.REQUEST_ID}, FORM_ID: ${request.FORM_ID}`);
      
      const response = await api.get(`/api/requests/${request.REQUEST_ID}/form`);
      console.log('=== FULL API RESPONSE ===');
      console.log('Status:', response.status);
      console.log('Success:', response.data?.success);
      console.log('Data exists:', !!response.data?.data);
      console.log('Full response:', JSON.stringify(response.data, null, 2));
      
      if (response.data && response.status === 200) {
        const formData = response.data;
        console.log('=== FORM DATA BREAKDOWN ===');
        console.log('Form info:', formData.form);
        console.log('Fields count:', formData.fields?.length || 0);
        console.log('Values object:', formData.values);
        console.log('Has existing data:', formData.hasExistingData);
        
        // Set form template information
        if (formData.form) {
          setFormTemplate({
            name: formData.form.FORM_NAME,
            description: formData.form.FORM_DESCRIPTION,
            id: formData.form.FORM_ID
          });
          console.log('✅ Set form template:', formData.form.FORM_NAME);
        } else {
          console.log('❌ No form template found in response');
          setFormTemplate(null);
        }
        
        // Convert form instance values to display format - ONLY show real database data
        const fieldValues: FormFieldValue[] = [];
        
        if (formData.fields && Array.isArray(formData.fields)) {
          console.log('=== PROCESSING FIELDS ===');
          formData.fields.forEach((field: any) => {
            // Get the actual value - try both field ID and field name as keys
            const valueByName = formData.values?.[field.FIELD_NAME];
            const valueById = formData.values?.[field.FIELD_ID];
            const value = valueByName || valueById;
            
            fieldValues.push({
              fieldName: field.FIELD_NAME,
              fieldValue: value && value.toString().trim() !== '' 
                ? value // Real database value from FORMS_INSTANCE_VALUES
                : '' // Empty string for unfilled fields
            });
            
            console.log(`Field: ${field.FIELD_NAME} (ID: ${field.FIELD_ID})`);
            console.log(`  Value by name: "${valueByName || 'EMPTY'}"`);
            console.log(`  Value by ID: "${valueById || 'EMPTY'}"`);
            console.log(`  Final value: "${value || 'EMPTY'}"`);
            console.log(`  Has Value: ${!!(value && value.toString().trim())}`);
          });
        } else {
          console.log('❌ No fields found in response');
        }
        
        setFormFieldValues(fieldValues);
        console.log('✅ Final processed field values:', fieldValues);
      } else {
        console.log('❌ API response not successful or no data');
        console.log('Response status:', response.status);
        console.log('Response data exists:', !!response.data);
        setFormTemplate(null);
        setFormFieldValues([]);
      }
    } catch (err) {
      console.error('Failed to load form field values:', err);
      // NO fallback data - only show real database data
      setFormTemplate(null);
      setFormFieldValues([]);
    } finally {
      setFormLoading(false);
    }
  };

  // Fetch tasks for this request
  const fetchTasks = async () => {
    try {
      setTasksLoading(true);
      console.log(`📋 Fetching tasks for request ${request.REQUEST_ID}`);
      
      const response = await api.get(`/api/requests/${request.REQUEST_ID}/tasks`);
      console.log('📋 Tasks API response:', response.data);
      
      if (response.data && response.data.success) {
        const newTasks = response.data.data || [];  // Changed from 'tasks' to 'data'
        console.log(`✅ Setting ${newTasks.length} tasks in state:`, newTasks);
        setTasks(newTasks);
        console.log(`✅ Tasks state should now have ${newTasks.length} items`);
      } else {
        console.log('❌ Tasks API response not successful');
        setTasks([]);
      }
    } catch (error) {
      console.error('❌ Error fetching tasks:', error);
      setTasks([]);
    } finally {
      setTasksLoading(false);
    }
  };

  // Fetch attachments for this request
  const fetchAttachments = async () => {
    try {
      setAttachmentsLoading(true);
      console.log(`📎 Fetching attachments for request ${request.REQUEST_ID}`);
      
      const response = await api.get(`/api/requests/${request.REQUEST_ID}/attachments`);
      console.log('📎 Attachments API response:', response.data);
      
      if (response.data && response.data.success) {
        const attachmentsData = response.data.attachments || [];
        console.log(`✅ Found ${attachmentsData.length} attachments:`, attachmentsData);
        setAttachments(attachmentsData);
      } else {
        console.log('❌ Attachments API response not successful');
        setAttachments([]);
      }
    } catch (error) {
      console.error('❌ Error fetching attachments:', error);
      setAttachments([]);
    } finally {
      setAttachmentsLoading(false);
    }
  };

  // Handle add task
  const handleAddTask = async () => {
    if (!newTaskData.description.trim()) {
      toast.error('Please enter a task description');
      return;
    }

    try {
      setTaskActionLoading(true);
      console.log('➕ Adding new task:', newTaskData);

      const response = await api.post('/api/tasks', {
        requestId: request.REQUEST_ID,
        assignedUserId: newTaskData.assignedUserId || null,
        description: newTaskData.description.trim(),
        status: 'Pending'
      });

      if (response.data && response.data.success) {
        toast.success('Task created successfully!');
        setShowAddTaskModal(false);
        setNewTaskData({ assignedUserId: '', description: '' });
        await fetchTasks(); // Refresh tasks list
      } else {
        toast.error('Failed to create task');
      }
    } catch (error: any) {
      console.error('❌ Error adding task:', error);
      toast.error(error.response?.data?.error || 'Failed to create task');
    } finally {
      setTaskActionLoading(false);
    }
  };

  // Handle task status updates
  const handleTaskStatusUpdate = async (taskIds: number[], newStatus: string) => {
    if (taskIds.length === 0) {
      toast.error('Please select tasks to update');
      return;
    }

    try {
      setTaskActionLoading(true);
      console.log(`🔄 Updating ${taskIds.length} tasks to status: ${newStatus}`);

      // Update each selected task in parallel (status updates are lightweight)
      const promises = taskIds.map(taskId =>
        api.put(`/api/tasks/${taskId}`, { status: newStatus })
      );

      const responses = await Promise.all(promises);
      const successful = responses.filter(r => r.data && r.data.success);

      if (successful.length === taskIds.length) {
        toast.success(`${successful.length} task(s) updated successfully!`);
        setSelectedTasks(new Set()); // Clear selection
        await fetchTasks(); // Refresh tasks list
      } else {
        toast.warning(`${successful.length} of ${taskIds.length} tasks updated`);
        await fetchTasks(); // Refresh tasks list anyway
      }
    } catch (error: any) {
      console.error('❌ Error updating tasks:', error);
      toast.error(error.response?.data?.error || 'Failed to update tasks');
    } finally {
      setTaskActionLoading(false);
    }
  };

  // Handle task assignment (sequential to avoid DB pool overload)
  const handleTaskAssign = async (taskIds: number[], assignedUserId: string) => {
    if (taskIds.length === 0) {
      toast.error('Please select tasks to assign');
      return;
    }

    if (!assignedUserId) {
      toast.error('Please select a user to assign tasks to');
      return;
    }

    try {
      setTaskActionLoading(true);
      console.log(`👤 Assigning ${taskIds.length} tasks to user ${assignedUserId}`);

      let successCount = 0;
      for (const taskId of taskIds) {
        try {
          const res = await api.put(`/api/tasks/${taskId}`, { assignedUserId: parseInt(assignedUserId, 10) });
          if (res.data?.success) successCount += 1;
        } catch (err: any) {
          console.error(`❌ Failed to assign task ${taskId}:`, err?.response?.data || err?.message || err);
        }
        // gentle pacing
        await new Promise(r => setTimeout(r, 50));
      }

      if (successCount === taskIds.length) {
        toast.success(`${successCount} task(s) assigned successfully!`);
        setSelectedTasks(new Set());
        await fetchTasks();
      } else {
        toast.warning(`${successCount} of ${taskIds.length} tasks assigned`);
        await fetchTasks();
      }
    } catch (error: any) {
      console.error('❌ Error assigning tasks:', error);
      toast.error(error.response?.data?.error || 'Failed to assign tasks');
    } finally {
      setTaskActionLoading(false);
    }
  };

  // Handle select all tasks
  const handleSelectAllTasks = (checked: boolean) => {
    if (checked) {
      setSelectedTasks(new Set(tasks.map(task => task.TASK_ID)));
    } else {
      setSelectedTasks(new Set());
    }
  };

  // Handle single task checkbox
  const handleTaskSelect = (taskId: number, checked: boolean) => {
    setSelectedTasks(prev => {
      const next = new Set(prev);
      if (checked) next.add(taskId); else next.delete(taskId);
      return next;
    });
  };

  // Get task status badge class
  const getTaskStatusBadgeClass = (status: string) => {
    switch(status.toLowerCase()) {
      case 'pending': return 'badge bg-warning text-dark';
      case 'in progress': return 'badge bg-primary text-white';
      case 'completed': return 'badge bg-success text-white';
      case 'cancelled': return 'badge bg-danger text-white';
      default: return 'badge bg-secondary text-white';
    }
  };

  // Get task status text
  const getTaskStatusText = (status: string) => {
    switch(status.toLowerCase()) {
      case 'pending': return 'Pending';
      case 'in progress': return 'In Progress';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  };


  // Handle form field value changes
  const handleFieldValueChange = (fieldName: string, newValue: string) => {
    setFormFieldValues(prevValues => {
      const updatedValues = prevValues.map(field => 
        field.fieldName === fieldName 
          ? { ...field, fieldValue: newValue }
          : field
      );
      
      // Check if there are any changes from original values
      setFormHasChanges(true);
      
      return updatedValues;
    });
  };

  // Save form data to the server
  const handleSaveFormData = async () => {
    try {
      setIsSavingForm(true);
      
      // Prepare form data in the format the server expects
      const fieldValues = formFieldValues.reduce((acc, field) => {
        if (field.fieldValue && field.fieldValue.toString().trim() !== '') {
          acc[field.fieldName] = field.fieldValue;
        }
        return acc;
      }, {} as Record<string, string>);
      
      const submissionData = {
        fieldValues,
        isComplete: false, // Mark as draft/auto-save
        isDraft: true
      };
      
      console.log('Saving form data for request:', request.REQUEST_ID);
      console.log('Field values:', fieldValues);
      
      // Submit form data to the correct endpoint
      const response = await api.post(`/api/requests/${request.REQUEST_ID}/form/submit`, submissionData);
      
      if (response.status === 200 || response.status === 201) {
        console.log('✅ Form data saved successfully');
        setFormHasChanges(false);
        // Refresh the form data
        await fetchFormFieldValues();
      } else {
        console.error('❌ Failed to save form data:', response.status);
      }
    } catch (error) {
      console.error('❌ Error saving form data:', error);
    } finally {
      setIsSavingForm(false);
    }
  };

  // Handle user assignment
  const handleAssignUser = async () => {
    if (!selectedUser) return;
    
    try {
      setLoading(true);
      console.log(`📋 Assigning request ${request.REQUEST_ID} to user ${selectedUser}`);
      
      const response = await api.put(`/api/requests/${request.REQUEST_ID}/assign`, { 
        assignedUserId: selectedUser
      });
      
      if (response.status === 200 || response.data?.success) {
        console.log('✅ Assignment successful');
        toast.success('Request assigned successfully!');
        
        // Immediate refresh - no setTimeout needed
        onUpdate();
        onHide();
      } else {
        console.error('❌ Assignment failed:', response);
        toast.error('Failed to assign request');
      }
    } catch (err: any) {
      console.error('❌ Failed to assign user:', err);
      toast.error(err.response?.data?.error || 'Failed to assign request');
    } finally {
      setLoading(false);
    }
  };

  // Work action handlers
  const handleStartWork = async () => {
    try {
      setWorkActionLoading(true);
      console.log('🚀 Starting work on request:', request.REQUEST_ID);
      
      const response = await api.post(`/api/requests/${request.REQUEST_ID}/start`);
      
      if (response.data.success) {
        toast.success(`Started work on ${request.REQUEST_NAME}`);
        setShowWorkSection(true); // Show work management section
        onUpdate(); // Refresh parent component
      } else {
        toast.error('Failed to start work on request');
      }
    } catch (error: any) {
      console.error('Error starting work:', error);
      toast.error(error.response?.data?.error || 'Failed to start work');
    } finally {
      setWorkActionLoading(false);
    }
  };

  const handleCompleteWork = async () => {
    try {
      setWorkActionLoading(true);
      console.log('✅ Completing request:', request.REQUEST_ID);
      
      const response = await api.post(`/api/requests/${request.REQUEST_ID}/complete`, {
        completionNotes: feedbackText || 'Request completed'
      });
      
      if (response.data.success) {
        toast.success(`Completed ${request.REQUEST_NAME}`);
        onUpdate(); // Refresh parent component
        onHide(); // Close modal
      } else {
        toast.error('Failed to complete request');
      }
    } catch (error: any) {
      console.error('Error completing work:', error);
      toast.error(error.response?.data?.error || 'Failed to complete request');
    } finally {
      setWorkActionLoading(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackText.trim() && feedbackFiles.length === 0) {
      toast.error('Please provide feedback text or upload files');
      return;
    }

    try {
      setWorkActionLoading(true);
      
      // Create form data for file uploads
      const formData = new FormData();
      formData.append('progressType', 'communication');
      formData.append('title', `${feedbackType.charAt(0).toUpperCase() + feedbackType.slice(1)} - Feedback`);
      formData.append('description', feedbackText);
      formData.append('isVisibleToRequestor', 'true');
      formData.append('hoursWorked', '0');
      
      // Add first file if any
      if (feedbackFiles.length > 0) {
        formData.append('attachment', feedbackFiles[0]);
      }
      
      const response = await api.post(`/api/requests/${request.REQUEST_ID}/progress`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      if (response.data.success) {
        toast.success('Feedback submitted successfully!');
        setFeedbackText('');
        setFeedbackFiles([]);
        onUpdate(); // Refresh parent component
      } else {
        toast.error('Failed to submit feedback');
      }
    } catch (error: any) {
      console.error('Error submitting feedback:', error);
      toast.error(error.response?.data?.error || 'Failed to submit feedback');
    } finally {
      setWorkActionLoading(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    // Validate file types and sizes
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['image/', 'application/pdf', 'text/', 'application/msword', 'application/vnd.openxmlformats'];
    
    const validFiles = files.filter(file => {
      if (file.size > maxSize) {
        toast.error(`File ${file.name} is too large. Maximum size is 10MB.`);
        return false;
      }
      
      if (!allowedTypes.some(type => file.type.startsWith(type))) {
        toast.error(`File ${file.name} type is not allowed.`);
        return false;
      }
      
      return true;
    });
    
    setFeedbackFiles(prev => [...prev, ...validFiles]);
  };

  const removeFeedbackFile = (index: number) => {
    setFeedbackFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Handle results notes change
  const handleResultsNotesChange = (value: string) => {
    setResultsNotes(value);
    setResultsHasChanges(true);
  };

  // Save results notes
  const handleSaveResults = async () => {
    try {
      setSavingResults(true);
      console.log('💾 Saving results for request:', request.REQUEST_ID);
      
      // Save results notes to RESULTS_DESCRIPTION field
      if (resultsNotes.trim()) {
        console.log('💾 Saving results to RESULTS_DESCRIPTION field...');
        const descResponse = await api.put(`/api/requests/${request.REQUEST_ID}/description`, {
          description: resultsNotes.trim()
        });
        
        if (!descResponse.data.success) {
          toast.error('Failed to save results');
          return;
        }
        console.log('✅ Results saved to RESULTS_DESCRIPTION field');
      } else {
        // Clear the RESULTS_DESCRIPTION field if notes are empty
        console.log('💾 Clearing RESULTS_DESCRIPTION field...');
        const descResponse = await api.put(`/api/requests/${request.REQUEST_ID}/description`, {
          description: null
        });
        
        if (!descResponse.data.success) {
          toast.error('Failed to clear results');
          return;
        }
        console.log('✅ RESULTS_DESCRIPTION field cleared');
      }
      
      toast.success('Results saved successfully!');
      setResultsHasChanges(false);
      onUpdate(); // Refresh parent component
      
    } catch (error: any) {
      console.error('❌ Error saving results:', error);
      toast.error(error.response?.data?.error || 'Failed to save results');
    } finally {
      setSavingResults(false);
    }
  };

  // Handle complete request with results
  const handleCompleteRequestWithResults = async () => {
    if (!resultsNotes.trim()) {
      toast.error('Please provide results details before completing the request');
      return;
    }

    try {
      setSavingResults(true);
      console.log('✅ Completing request with results:', request.REQUEST_ID);
      
      // First save the results if there are changes
      if (resultsHasChanges) {
        await handleSaveResults();
      }
      
      // Then complete the request
      const response = await api.post(`/api/requests/${request.REQUEST_ID}/complete`, {
        completionNotes: resultsNotes
      });
      
      if (response.data.success) {
        toast.success(`Request completed successfully!`);
        onUpdate(); // Refresh parent component
        onHide(); // Close modal
      } else {
        toast.error('Failed to complete request');
      }
    } catch (error: any) {
      console.error('❌ Error completing request:', error);
      toast.error(error.response?.data?.error || 'Failed to complete request');
    } finally {
      setSavingResults(false);
    }
  };

  // Handle attachment download
  const handleDownloadAttachment = async (attachmentId: number, fileName: string) => {
    try {
      console.log(`⬇️ Downloading attachment ${attachmentId}: ${fileName}`);
      
      const response = await api.get(`/api/attachments/${attachmentId}/download`, {
        responseType: 'blob'
      });
      
      // Create a download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      console.log(`✅ Downloaded attachment: ${fileName}`);
    } catch (error: any) {
      console.error('❌ Error downloading attachment:', error);
      toast.error(error.response?.data?.error || 'Failed to download attachment');
    }
  };

  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered className="request-modal-improved">
      <Modal.Header closeButton className="border-0 pb-2">
        <Modal.Title className="fw-semibold text-dark" style={{ fontSize: '1.1rem' }}>
          Request Details: {request.TRACKINGID || `REQ-${request.REQUEST_ID}`}
        </Modal.Title>
      </Modal.Header>
      
      <Modal.Body className="pt-3">
        {/* Main Info Grid - Compact Layout */}
        <div className="row mb-3">
          {/* Left Column */}
          <div className="col-6">
            <div className="mb-2">
              <div className="text-muted small fw-medium mb-1" style={{ fontSize: '0.75rem' }}>Request ID</div>
              <div className="fw-semibold" style={{ fontSize: '0.9rem' }}>{request.TRACKINGID || `REQ-${request.REQUEST_ID}`}</div>
            </div>
            
            
            <div className="mb-2">
              <div className="text-muted small fw-medium mb-1" style={{ fontSize: '0.75rem' }}>Requestor</div>
              <div className="fw-semibold" style={{ fontSize: '0.9rem' }}>{request.requestorName || 'Ernest Pena Jr'}</div>
            </div>
          </div>
          
          {/* Right Column */}
          <div className="col-6">
            
            <div className="mb-2">
              <div className="text-muted small fw-medium mb-1" style={{ fontSize: '0.75rem' }}>Date Submitted</div>
              <div className="fw-semibold" style={{ fontSize: '0.9rem' }}>{formatDate(request.SUBMITTED_DATE || request.CREATE_DATE)}</div>
            </div>
            
            <div className="mb-2">
              <div className="text-muted small fw-medium mb-1" style={{ fontSize: '0.75rem' }}>Currently Assigned To</div>
              <div className="fw-semibold" style={{ fontSize: '0.9rem' }}>{request.assignedName || 'Unassigned'}</div>
            </div>
            
            <div className="mb-2">
              <div className="text-muted small fw-medium mb-1" style={{ fontSize: '0.75rem' }}>Status</div>
              <div>
                <span className={getStatusBadgeClass(request.STATUS)} style={{ fontSize: '0.75rem' }}>
                  {getStatusText(request.STATUS)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-top pt-3 mb-4">
          <div className="d-flex mb-0 border-bottom">
            <button
              className={`btn btn-sm border-0 px-3 py-2 ${
                activeMainTab === 'details' ? 'text-primary border-bottom border-primary border-2' : 'text-muted'
              }`}
              onClick={() => setActiveMainTab('details')}
              style={{ fontSize: '1rem', fontWeight: activeMainTab === 'details' ? '600' : '400' }}
            >
              Details
            </button>
            <button
              className={`btn btn-sm border-0 px-3 py-2 ms-2 ${
                activeMainTab === 'tasks' ? 'text-primary border-bottom border-primary border-2' : 'text-muted'
              }`}
              onClick={() => setActiveMainTab('tasks')}
              style={{ fontSize: '1rem', fontWeight: activeMainTab === 'tasks' ? '600' : '400' }}
            >
              Tasks
            </button>
            <button
              className={`btn btn-sm border-0 px-3 py-2 ms-2 ${
                activeMainTab === 'results' ? 'text-primary border-bottom border-primary border-2' : 'text-muted'
              }`}
              onClick={() => setActiveMainTab('results')}
              style={{ fontSize: '1rem', fontWeight: activeMainTab === 'results' ? '600' : '400' }}
            >
              Results
            </button>
            <button
              className={`btn btn-sm border-0 px-3 py-2 ms-2 ${
                activeMainTab === 'milestones' ? 'text-primary border-bottom border-primary border-2' : 'text-muted'
              }`}
              onClick={() => setActiveMainTab('milestones')}
              style={{ fontSize: '1rem', fontWeight: activeMainTab === 'milestones' ? '600' : '400' }}
            >
              Milestones
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="tab-content" style={{ minHeight: '400px' }}>
          
          {/* Details Tab */}
          {activeMainTab === 'details' && (
            <div className="tab-pane active">
              {/* Form Template Section - Compact */}
        {formTemplate && (
          <div className="border-top pt-3 mb-3">
            <div className="text-primary fw-semibold mb-1" style={{ fontSize: '1rem' }}>
              {formTemplate.name}
            </div>
            <div className="text-muted mb-2" style={{ fontSize: '0.85rem' }}>
              {formTemplate.description}
            </div>
          </div>
        )}

        {/* Form Field Values - Compact Layout */}
        {formLoading ? (
          <div className="text-center py-3">
            <div className="spinner-border spinner-border-sm text-primary" role="status">
              <span className="visually-hidden">Loading form data...</span>
            </div>
            <div className="mt-2 text-muted small">Loading form data...</div>
          </div>
        ) : formFieldValues.length > 0 ? (
          <div className="mb-3">
            {formFieldValues.map((field, index) => {
              const hasValue = field.fieldValue && field.fieldValue.toString().trim() !== '';
              const isRequired = field.fieldName.includes('*') || field.fieldName.includes('#');
              
              return (
                <div key={index} className="mb-2">
                  <label className="form-label fw-medium text-dark mb-1" style={{ fontSize: '0.85rem' }}>
                    {field.fieldName}
                    {isRequired && <span className="text-danger ms-1">*</span>}
                  </label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={field.fieldValue || ''}
                    placeholder={`Enter ${field.fieldName}`}
                    onChange={(e) => handleFieldValueChange(field.fieldName, e.target.value)}
                    style={{ 
                      backgroundColor: 'white',
                      color: '#212529',
                      fontSize: '0.85rem'
                    }}
                  />
                  {/* Compact status indicators */}
                  {hasValue && (
                    <div className="form-text text-success" style={{ fontSize: '0.7rem', marginTop: '2px' }}>
                      ✓ Value from database
                    </div>
                  )}
                  {!hasValue && (
                    <div className="form-text text-muted" style={{ fontSize: '0.7rem', marginTop: '2px' }}>
                      No value submitted yet
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : formTemplate ? (
          <div className="alert alert-info">
            <h6 className="alert-heading">Form Template Found</h6>
            <p className="mb-0">Template: <strong>{formTemplate.name}</strong></p>
            <p className="mb-0">Description: {formTemplate.description}</p>
            <hr className="my-2" />
            <small className="text-muted">No form fields found for this template. The form may not have been configured with fields yet.</small>
          </div>
        ) : (
          <div className="alert alert-warning">
            <h6 className="alert-heading">No Form Data Available</h6>
            <p className="mb-1">This request does not have an associated form template.</p>
            <hr className="my-2" />
            <small className="text-muted">
              Request ID: {request.REQUEST_ID}<br />
              Form ID: {request.FORM_ID || 'None'}<br />
              Check the browser console for detailed API response information.
            </small>
          </div>
        )}

        {/* Form Data Save Section */}
        {formFieldValues.length > 0 && (
          <div className="border-top pt-3 mt-3">
            <div className="d-flex gap-2 justify-content-between align-items-center mb-3">
              <div className="text-dark fw-semibold" style={{ fontSize: '0.9rem' }}>Form Data</div>
              <Button 
                variant="success" 
                onClick={handleSaveFormData}
                disabled={isSavingForm || !formHasChanges}
                size="sm"
                className="px-3"
                style={{ fontSize: '0.85rem' }}
              >
                {isSavingForm ? 'Saving...' : 'Save Form Data'}
              </Button>
            </div>
            {formHasChanges && (
              <div className="alert alert-warning py-2 mb-3" style={{ fontSize: '0.8rem' }}>
                <small>⚠️ You have unsaved changes to the form data.</small>
              </div>
            )}
          </div>
        )}

        {/* Work Management Section - Only show if user is assigned or can work on request */}
        {canWorkOnRequest && isAssignedToCurrentUser && (
          <div className="border-top pt-3 mt-3">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div className="text-dark fw-semibold" style={{ fontSize: '1rem' }}>
                Work Management
              </div>
              <div className="d-flex gap-2">
                {request.STATUS === 'P' && (
                  <Button 
                    variant="success" 
                    onClick={handleStartWork}
                    disabled={workActionLoading}
                    size="sm"
                    className="d-flex align-items-center"
                    style={{ fontSize: '0.85rem' }}
                  >
                    <Play size={14} className="me-1" />
                    {workActionLoading ? 'Starting...' : 'Start Work'}
                  </Button>
                )}
                {request.STATUS === 'A' && (
                  <>
                    <Button 
                      variant="primary" 
                      onClick={() => setShowWorkSection(!showWorkSection)}
                      size="sm"
                      className="d-flex align-items-center"
                      style={{ fontSize: '0.85rem' }}
                    >
                      <MessageSquare size={14} className="me-1" />
                      {showWorkSection ? 'Hide' : 'Manage'} Work
                    </Button>
                    <Button 
                      variant="success" 
                      onClick={handleCompleteWork}
                      disabled={workActionLoading}
                      size="sm"
                      className="d-flex align-items-center"
                      style={{ fontSize: '0.85rem' }}
                    >
                      <CheckCircle size={14} className="me-1" />
                      {workActionLoading ? 'Completing...' : 'Complete Work'}
                    </Button>
                  </>
                )}
              </div>
            </div>
            
            {/* Work Section Content */}
            {(showWorkSection || request.STATUS === 'P') && (
              <div className="bg-light rounded p-3">
                {/* Work Tabs */}
                <div className="d-flex mb-3 border-bottom">
                  <button
                    className={`btn btn-sm border-0 px-2 py-1 ${
                      activeWorkTab === 'feedback' ? 'text-primary border-bottom border-primary' : 'text-muted'
                    }`}
                    onClick={() => setActiveWorkTab('feedback')}
                  >
                    <MessageSquare size={14} className="me-1" />
                    Feedback
                  </button>
                  <button
                    className={`btn btn-sm border-0 px-2 py-1 ms-2 ${
                      activeWorkTab === 'files' ? 'text-primary border-bottom border-primary' : 'text-muted'
                    }`}
                    onClick={() => setActiveWorkTab('files')}
                  >
                    <FileText size={14} className="me-1" />
                    Files
                  </button>
                  <button
                    className={`btn btn-sm border-0 px-2 py-1 ms-2 ${
                      activeWorkTab === 'status' ? 'text-primary border-bottom border-primary' : 'text-muted'
                    }`}
                    onClick={() => setActiveWorkTab('status')}
                  >
                    <CheckCircle size={14} className="me-1" />
                    Status
                  </button>
                </div>
                
                {/* Feedback Tab */}
                {activeWorkTab === 'feedback' && (
                  <div>
                    <div className="mb-3">
                      <label className="form-label fw-medium" style={{ fontSize: '0.85rem' }}>
                        Feedback Type
                      </label>
                      <div className="d-flex gap-2 mb-3">
                        {[
                          { type: 'update', label: 'Update', color: 'primary', desc: 'Progress updates' },
                          { type: 'question', label: 'Question', color: 'warning', desc: 'Will notify requestor' },
                          { type: 'issue', label: 'Issue', color: 'danger', desc: 'Report problems' }
                        ].map(({ type, label, color, desc }) => (
                          <button
                            key={type}
                            className={`btn btn-sm ${
                              feedbackType === type ? `btn-${color}` : `btn-outline-${color}`
                            }`}
                            onClick={() => setFeedbackType(type)}
                            style={{ fontSize: '0.75rem' }}
                            title={desc}
                          >
                            {label}
                            {type === 'question' && feedbackType === type && (
                              <span className="d-block" style={{ fontSize: '0.6rem', opacity: 0.8 }}>
                                📧 Notifies requestor
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="mb-3">
                      <label className="form-label fw-medium" style={{ fontSize: '0.85rem' }}>
                        Feedback Message
                      </label>
                      <textarea
                        className="form-control"
                        rows={4}
                        placeholder="Provide feedback, updates, or ask questions..."
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        style={{ fontSize: '0.85rem' }}
                      />
                    </div>
                    
                    {/* Question notification info */}
                    {feedbackType === 'question' && (
                      <div className="alert alert-info py-2 mb-3" style={{ fontSize: '0.8rem' }}>
                        📧 <strong>Question Mode:</strong> The requestor ({request.requestorName || 'Unknown'}) will receive an email notification and in-app alert that you have a question about their request.
                      </div>
                    )}
                    
                    <div className="d-flex justify-content-end">
                      <Button
                        variant={feedbackType === 'question' ? 'warning' : 'primary'}
                        onClick={handleSubmitFeedback}
                        disabled={workActionLoading || (!feedbackText.trim() && feedbackFiles.length === 0)}
                        size="sm"
                        className="d-flex align-items-center"
                        style={{ fontSize: '0.85rem' }}
                      >
                        <Send size={14} className="me-1" />
                        {workActionLoading ? 'Submitting...' : 
                         feedbackType === 'question' ? 'Send Question' : 'Submit Feedback'}
                      </Button>
                    </div>
                  </div>
                )}
                
                {/* Files Tab */}
                {activeWorkTab === 'files' && (
                  <div>
                    <div className="mb-3">
                      <label className="form-label fw-medium" style={{ fontSize: '0.85rem' }}>
                        Upload Supporting Files
                      </label>
                      <input
                        type="file"
                        multiple
                        onChange={handleFileUpload}
                        className="form-control"
                        accept="image/*,.pdf,.doc,.docx,.txt"
                        style={{ fontSize: '0.85rem' }}
                      />
                      <div className="form-text" style={{ fontSize: '0.75rem' }}>
                        Accepted: Images, PDF, Word, Text files (Max 10MB each)
                      </div>
                    </div>
                    
                    {feedbackFiles.length > 0 && (
                      <div>
                        <div className="fw-medium mb-2" style={{ fontSize: '0.85rem' }}>
                          Selected Files ({feedbackFiles.length})
                        </div>
                        {feedbackFiles.map((file, index) => (
                          <div key={index} className="d-flex justify-content-between align-items-center p-2 bg-white rounded border mb-2">
                            <div style={{ fontSize: '0.8rem' }}>
                              <div className="fw-medium">{file.name}</div>
                              <div className="text-muted">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                            </div>
                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => removeFeedbackFile(index)}
                              style={{ fontSize: '0.75rem' }}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Status Tab */}
                {activeWorkTab === 'status' && (
                  <div>
                    <div className="mb-3">
                      <div className="fw-medium mb-2" style={{ fontSize: '0.85rem' }}>
                        Current Status: <span className={getStatusBadgeClass(request.STATUS)}>
                          {getStatusText(request.STATUS)}
                        </span>
                      </div>
                      <div className="text-muted" style={{ fontSize: '0.8rem' }}>
                        {request.STATUS === 'P' && 'Click "Start Work" to begin working on this request.'}
                        {request.STATUS === 'A' && 'You are currently working on this request. You can provide feedback or mark it as complete.'}
                        {request.STATUS === 'C' && 'This request has been completed.'}
                      </div>
                    </div>
                    
                    {request.STATUS === 'A' && (
                      <div className="d-flex justify-content-end">
                        <Button
                          variant="success"
                          onClick={handleCompleteWork}
                          disabled={workActionLoading}
                          size="sm"
                          className="d-flex align-items-center"
                          style={{ fontSize: '0.85rem' }}
                        >
                          <CheckCircle size={14} className="me-1" />
                          {workActionLoading ? 'Completing...' : 'Mark as Complete'}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Requestor Response Section - Only show if user is the requestor */}
        {isRequestorUser && !isAssignedToCurrentUser && (
          <div className="border-top pt-3 mt-3">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div className="text-dark fw-semibold" style={{ fontSize: '1rem' }}>
                📝 Respond to Processor
              </div>
              <span className="badge bg-info" style={{ fontSize: '0.75rem' }}>
                Your Request
              </span>
            </div>
            
            <div className="bg-light rounded p-3">
              <div className="mb-3">
                <label className="form-label fw-medium" style={{ fontSize: '0.85rem' }}>
                  Response to Processor
                </label>
                <textarea
                  className="form-control"
                  rows={4}
                  placeholder="Provide additional information, answer questions, or clarify details..."
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  style={{ fontSize: '0.85rem' }}
                />
                <div className="form-text" style={{ fontSize: '0.75rem' }}>
                  Your response will be sent to the assigned processor and may help speed up your request.
                </div>
              </div>
              
              {/* File upload for requestors */}
              <div className="mb-3">
                <label className="form-label fw-medium" style={{ fontSize: '0.85rem' }}>
                  Additional Documents
                </label>
                <input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="form-control"
                  accept="image/*,.pdf,.doc,.docx,.txt"
                  style={{ fontSize: '0.85rem' }}
                />
                <div className="form-text" style={{ fontSize: '0.75rem' }}>
                  Upload additional documents that may help with your request
                </div>
              </div>
              
              {/* Show selected files */}
              {feedbackFiles.length > 0 && (
                <div className="mb-3">
                  <div className="fw-medium mb-2" style={{ fontSize: '0.85rem' }}>
                    Selected Files ({feedbackFiles.length})
                  </div>
                  {feedbackFiles.map((file, index) => (
                    <div key={index} className="d-flex justify-content-between align-items-center p-2 bg-white rounded border mb-2">
                      <div style={{ fontSize: '0.8rem' }}>
                        <div className="fw-medium">{file.name}</div>
                        <div className="text-muted">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                      </div>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => removeFeedbackFile(index)}
                        style={{ fontSize: '0.75rem' }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="d-flex justify-content-end">
                <Button
                  variant="primary"
                  onClick={async () => {
                    // Use same feedback mechanism but with requestor context
                    const originalType = feedbackType;
                    setFeedbackType('update'); // Set as update from requestor
                    await handleSubmitFeedback();
                    setFeedbackType(originalType);
                  }}
                  disabled={workActionLoading || (!feedbackText.trim() && feedbackFiles.length === 0)}
                  size="sm"
                  className="d-flex align-items-center"
                  style={{ fontSize: '0.85rem' }}
                >
                  <Send size={14} className="me-1" />
                  {workActionLoading ? 'Sending...' : 'Send Response'}
                </Button>
              </div>
            </div>
          </div>
        )}

              {/* Assignment Section - Only show if user has permission */}
              {hasAssignPermission ? (
                <div className="border-top pt-3 mt-3">
                  <div className="text-dark fw-semibold mb-2" style={{ fontSize: '0.9rem' }}>Assign Request</div>
                  
                  <Form.Select 
                    value={selectedUser} 
                    onChange={(e) => setSelectedUser(e.target.value)}
                    disabled={loading}
                    className="mb-3 form-select-sm"
                    style={{ fontSize: '0.85rem' }}
                  >
                    <option value="">Select a processor to assign</option>
                    {users.map((user) => (
                      <option key={user.USER_ID} value={user.USER_ID}>
                        {user.FULL_NAME} ({user.ROLE_NAMES})
                      </option>
                    ))}
                  </Form.Select>
                  
                  <div className="d-flex gap-2 justify-content-end">
                    <Button 
                      variant="outline-secondary" 
                      onClick={onHide} 
                      size="sm"
                      className="px-3"
                      style={{ fontSize: '0.85rem' }}
                    >
                      Close
                    </Button>
                    <Button 
                      variant="primary" 
                      onClick={handleAssignUser}
                      disabled={!selectedUser || loading}
                      size="sm"
                      className="px-3"
                      style={{ fontSize: '0.85rem' }}
                    >
                      {loading ? 'Assigning...' : 'Assign'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="border-top pt-3 mt-3">
                  <div className="d-flex justify-content-end">
                    <Button 
                      variant="outline-secondary" 
                      onClick={onHide} 
                      size="sm"
                      className="px-3"
                      style={{ fontSize: '0.85rem' }}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tasks Tab */}
          {activeMainTab === 'tasks' && (
            <div className="tab-pane active">
              <div className="mb-3">
                <div className="mb-3">
                  <div className="d-flex align-items-center mb-2">
                    <h6 className="mb-0 me-2">Task Management</h6>
                    {selectedTasks.size > 0 && (
                      <span className="badge bg-primary">{selectedTasks.size} selected</span>
                    )}
                  </div>
                  <div className="d-flex gap-2 flex-wrap">
                    <Button 
                      size="sm" 
                      variant="primary"
                      onClick={() => setShowAddTaskModal(true)}
                      disabled={taskActionLoading}
                    >
                      Add
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline-secondary"
                      onClick={() => setShowAssignTaskModal(true)}
                      disabled={taskActionLoading || selectedTasks.size === 0}
                    >
                      Assign
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline-success"
                      onClick={() => handleTaskStatusUpdate(Array.from(selectedTasks), 'In Progress')}
                      disabled={taskActionLoading || selectedTasks.size === 0}
                    >
                      Start
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline-success"
                      onClick={() => handleTaskStatusUpdate(Array.from(selectedTasks), 'Completed')}
                      disabled={taskActionLoading || selectedTasks.size === 0}
                    >
                      Complete
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline-danger"
                      onClick={() => handleTaskStatusUpdate(Array.from(selectedTasks), 'Cancelled')}
                      disabled={taskActionLoading || selectedTasks.size === 0}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
                
                {/* Task Table */}
                {tasksLoading ? (
                  <div className="text-center py-4">
                    <div className="spinner-border spinner-border-sm text-primary" role="status">
                      <span className="visually-hidden">Loading tasks...</span>
                    </div>
                    <div className="mt-2 text-muted small">Loading tasks...</div>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-sm table-hover">
                      <thead className="bg-light">
                        <tr>
                          <th width="50">
                            <input 
                              type="checkbox" 
                              className="form-check-input"
                              checked={tasks.length > 0 && selectedTasks.size === tasks.length}
                              onChange={(e) => handleSelectAllTasks(e.target.checked)}
                            />
                          </th>
                          <th>Task ID</th>
                          <th>Status</th>
                          <th>Assigned To</th>
                          <th>Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          console.log(`🎯 Rendering task table with ${tasks.length} tasks:`, tasks);
                          return null;
                        })()}
                        {tasks.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center text-muted py-4">
                              <div>No tasks found for this request</div>
                              <small>Click "Add" to create the first task</small>
                            </td>
                          </tr>
                        ) : (
                          tasks.map((task: Task) => (
                            <tr key={task.TASK_ID}>
                              <td>
                                <input 
                                  type="checkbox" 
                                  className="form-check-input"
                                  checked={selectedTasks.has(task.TASK_ID)}
                                  onChange={(e) => handleTaskSelect(task.TASK_ID, e.target.checked)}
                                />
                              </td>
                              <td>
                                <code>T-{task.TASK_ID}</code>
                              </td>
                              <td>
                                <span className={getTaskStatusBadgeClass(task.STATUS)}>
                                  {getTaskStatusText(task.STATUS)}
                                </span>
                              </td>
                              <td>
                                {task.assignedUser ? 
                                  task.assignedUser.FULL_NAME || 
                                  `${task.assignedUser.FIRST_NAME} ${task.assignedUser.LAST_NAME}` 
                                  : 'Unassigned'}
                              </td>
                              <td>
                                <span title={task.DESCRIPTION} className="text-truncate d-inline-block" style={{ maxWidth: '200px' }}>
                                  {task.DESCRIPTION}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Results Tab */}
          {activeMainTab === 'results' && (
            <div className="tab-pane active">
              <div className="mb-4">
                
                {/* Notes and Results Section */}
                <div className="card mb-4">
                  <div className="card-header bg-light d-flex justify-content-between align-items-center">
                    <h6 className="mb-0 fw-semibold">Notes and Results</h6>
                    <div className="d-flex align-items-center gap-2">
                      <span className="text-muted small">
                        {resultsNotes.length}/4000
                      </span>
                      {resultsHasChanges && (
                        <span className="badge bg-warning text-dark d-inline-flex align-items-center px-2 py-1">
                          <Save size={12} className="me-1 align-middle" />
                          <span className="align-middle">Unsaved Changes</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="card-body">
                    <Form.Group className="mb-3">
                      <Form.Control
                        as="textarea"
                        rows={8}
                        maxLength={4000}
                        placeholder="Document the results of this request, findings, outcomes, or any relevant information..."
                        value={resultsNotes}
                        onChange={(e) => handleResultsNotesChange(e.target.value)}
                        className="form-control"
                        style={{ 
                          minHeight: '200px',
                          fontSize: '0.9rem',
                          lineHeight: '1.5'
                        }}
                      />
                      <Form.Text className="text-muted">
                        This information will be visible to the requestor and stored as part of the request record.
                      </Form.Text>
                    </Form.Group>

                    {/* Action Buttons */}
                    <div className="d-flex gap-2 justify-content-end">
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={handleSaveResults}
                        disabled={savingResults || !resultsHasChanges}
                        className="d-flex align-items-center"
                      >
                        <Save size={14} className="me-1" />
                        {savingResults ? 'Saving...' : 'Save Results'}
                      </Button>
                      
                      {canWorkOnRequest && isAssignedToCurrentUser && request.STATUS !== 'C' && (
                        <Button
                          variant="success"
                          size="sm"
                          onClick={handleCompleteRequestWithResults}
                          disabled={savingResults || !resultsNotes.trim()}
                          className="d-flex align-items-center"
                        >
                          <CheckCircle size={14} className="me-1" />
                          {savingResults ? 'Completing...' : 'Complete Request'}
                        </Button>
                      )}
                    </div>

                    {!resultsNotes.trim() && (
                      <div className="alert alert-info mt-3 py-2" style={{ fontSize: '0.85rem' }}>
                        <strong>Tip:</strong> Add detailed results and findings here. This helps maintain a complete record of the request outcome.
                      </div>
                    )}
                  </div>
                </div>

                {/* Supporting Documentation Section */}
                <div className="card">
                  <div className="card-header bg-light d-flex justify-content-between align-items-center">
                    <h6 className="mb-0 fw-semibold">Supporting Documentation</h6>
                    <span className="badge bg-secondary">
                      {attachmentsLoading ? 'Loading...' : `${attachments.length} document${attachments.length !== 1 ? 's' : ''}`}
                    </span>
                  </div>
                  <div className="card-body">
                    {attachmentsLoading ? (
                      <div className="text-center py-4">
                        <div className="spinner-border spinner-border-sm text-primary" role="status">
                          <span className="visually-hidden">Loading attachments...</span>
                        </div>
                        <div className="mt-2 text-muted small">Loading documents...</div>
                      </div>
                    ) : attachments.length > 0 ? (
                      <div className="row g-3">
                        {attachments.map((attachment: Attachment) => (
                          <div key={attachment.attachmentId} className="col-md-6">
                            <div className="border rounded p-3 h-100 d-flex flex-column">
                              <div className="d-flex align-items-start mb-2">
                                <FileText size={20} className="text-primary me-2 flex-shrink-0 mt-1" />
                                <div className="flex-grow-1 min-w-0">
                                  <h6 className="mb-1 fw-medium text-truncate" title={attachment.fileName}>
                                    {attachment.fileName}
                                  </h6>
                                  <div className="text-muted small">
                                    <div>Uploaded by: {attachment.uploadedBy.firstName} {attachment.uploadedBy.lastName}</div>
                                    <div>Date: {formatDate(attachment.createDate)}</div>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="mt-auto">
                                <Button
                                  variant="outline-primary"
                                  size="sm"
                                  onClick={() => handleDownloadAttachment(attachment.attachmentId, attachment.fileName)}
                                  className="d-flex align-items-center w-100"
                                >
                                  <Download size={14} className="me-1" />
                                  Download
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <FileText size={48} className="text-muted mb-3" />
                        <h6 className="text-muted mb-2">No Documents Available</h6>
                        <p className="text-muted small mb-0">
                          No supporting documents have been uploaded for this request yet.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Request Summary (Optional) */}
                {request.STATUS === 'C' && (
                  <div className="card mt-3 border-success">
                    <div className="card-header bg-success bg-opacity-10 border-success">
                      <h6 className="mb-0 fw-semibold text-success">
                        <CheckCircle size={16} className="me-1" />
                        Request Completed
                      </h6>
                    </div>
                    <div className="card-body">
                      <div className="row">
                        <div className="col-sm-6">
                          <small className="text-muted">Request ID:</small>
                          <div className="fw-medium">{request.TRACKINGID || `REQ-${request.REQUEST_ID}`}</div>
                        </div>
                        <div className="col-sm-6">
                          <small className="text-muted">Completed by:</small>
                          <div className="fw-medium">{request.assignedName || 'Unknown'}</div>
                        </div>
                        <div className="col-sm-6 mt-2">
                          <small className="text-muted">Completion Date:</small>
                          <div className="fw-medium">{formatDate(request.UPDATE_DATE)}</div>
                        </div>
                        <div className="col-sm-6 mt-2">
                          <small className="text-muted">Total Documents:</small>
                          <div className="fw-medium">{attachments.length}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Milestones Tab */}
          {activeMainTab === 'milestones' && (
            <div className="tab-pane active">
              <div className="mb-3">
                <h6 className="mb-3">Request Lifecycle Events</h6>
                
                <div className="timeline">
                  <div className="timeline-item">
                    <div className="timeline-marker bg-primary"></div>
                    <div className="timeline-content">
                      <div className="d-flex justify-content-between align-items-start">
                        <div>
                          <strong>Request Submitted</strong>
                          <div className="text-muted small">by {request.requestorName || 'Ernest Pena Jr'}</div>
                        </div>
                        <small className="text-muted">
                          {formatDate(request.SUBMITTED_DATE || request.CREATE_DATE)}
                        </small>
                      </div>
                    </div>
                  </div>
                  
                  {request.ASSIGNED_ID && (
                    <div className="timeline-item">
                      <div className="timeline-marker bg-info"></div>
                      <div className="timeline-content">
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <strong>Request Assigned</strong>
                            <div className="text-muted small">to {request.assignedName || 'Unknown'}</div>
                          </div>
                          <small className="text-muted">
                            {formatDate(request.UPDATE_DATE)}
                          </small>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {request.STATUS === 'A' && (
                    <div className="timeline-item">
                      <div className="timeline-marker bg-warning"></div>
                      <div className="timeline-content">
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <strong>Work Started</strong>
                            <div className="text-muted small">by {request.assignedName || 'Unknown'}</div>
                          </div>
                          <small className="text-muted">
                            {formatDate(request.UPDATE_DATE)}
                          </small>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {request.STATUS === 'C' && (
                    <div className="timeline-item">
                      <div className="timeline-marker bg-success"></div>
                      <div className="timeline-content">
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <strong>Request Completed</strong>
                            <div className="text-muted small">by {request.assignedName || 'Unknown'}</div>
                          </div>
                          <small className="text-muted">
                            {formatDate(request.UPDATE_DATE)}
                          </small>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal.Body>

      {/* Add Task Modal */}
      <Modal show={showAddTaskModal} onHide={() => setShowAddTaskModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Add New Task</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Task Description *</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                placeholder="Enter task description..."
                value={newTaskData.description}
                onChange={(e) => setNewTaskData({...newTaskData, description: e.target.value})}
                required
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Assign To (Optional)</Form.Label>
              <Form.Select
                value={newTaskData.assignedUserId}
                onChange={(e) => setNewTaskData({...newTaskData, assignedUserId: e.target.value})}
              >
                <option value="">Leave Unassigned</option>
                {users.map((user) => (
                  <option key={user.USER_ID} value={user.USER_ID}>
                    {user.FULL_NAME} ({user.ROLE_NAMES})
                  </option>
                ))}
              </Form.Select>
              <Form.Text className="text-muted">
                You can assign this task to a specific user or leave it unassigned
              </Form.Text>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button 
            variant="secondary" 
            onClick={() => {
              setShowAddTaskModal(false);
              setNewTaskData({ assignedUserId: '', description: '' });
            }}
            disabled={taskActionLoading}
          >
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleAddTask}
            disabled={taskActionLoading || !newTaskData.description.trim()}
          >
            {taskActionLoading ? 'Creating...' : 'Create Task'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Assign Task Modal */}
      <Modal show={showAssignTaskModal} onHide={() => setShowAssignTaskModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Assign Selected Tasks</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="mb-3">
            <div className="alert alert-info py-2">
              <small>
                <strong>{selectedTasks.size} task{selectedTasks.size !== 1 ? 's' : ''} selected</strong>
                <br />
                All selected tasks will be assigned to the chosen user.
              </small>
            </div>
          </div>
          
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Assign To *</Form.Label>
              <Form.Select
                value={assignTaskData.assignedUserId}
                onChange={(e) => setAssignTaskData({...assignTaskData, assignedUserId: e.target.value})}
                required
              >
                <option value="">Select a user to assign tasks to...</option>
                {users.map((user) => (
                  <option key={user.USER_ID} value={user.USER_ID}>
                    {user.FULL_NAME} ({user.ROLE_NAMES})
                  </option>
                ))}
              </Form.Select>
              <Form.Text className="text-muted">
                Choose a user who will be responsible for completing the selected tasks
              </Form.Text>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button 
            variant="secondary" 
            onClick={() => {
              setShowAssignTaskModal(false);
              setAssignTaskData({ assignedUserId: '' });
            }}
            disabled={taskActionLoading}
          >
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleAssignTasks}
            disabled={taskActionLoading || !assignTaskData.assignedUserId}
          >
            {taskActionLoading ? 'Assigning...' : `Assign ${selectedTasks.size} Task${selectedTasks.size !== 1 ? 's' : ''}`}
          </Button>
        </Modal.Footer>
      </Modal>
    </Modal>
  );
};

export default RequestModal;