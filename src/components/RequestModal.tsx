import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import { useDropzone } from 'react-dropzone';
import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'react-toastify';
import { Upload, MessageSquare, CheckCircle, FileText, Send, Download, Save, X } from 'lucide-react';
import './RequestModal.css';
import SectionedFormRenderer from './SectionedFormRenderer';

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
  fieldId: number;
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

interface Milestone {
  workProgressId: number;
  requestId: number;
  progressType: 'note' | 'milestone' | 'status' | 'task' | 'document' | 'form' | 'system';
  title: string;
  description: string;
  createDate: string;
  isSystemGenerated: boolean;
  relatedTaskId?: number;
  statusFrom?: string;
  statusTo?: string;
  eventData?: any;
  user: {
    firstName: string;
    lastName: string;
    email: string;
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
  const formFieldValuesRef = useRef(formFieldValues);
  useEffect(() => { formFieldValuesRef.current = formFieldValues; }, [formFieldValues]);
  const [formFields, setFormFields] = useState<any[]>([]);
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
  const [activeMainTab, setActiveMainTab] = useState<'details' | 'tasks' | 'results' | 'attachments' | 'milestones'>('details');
  
  // Results tab state
  const [resultsNotes, setResultsNotes] = useState<string>('');
  const [attachments, setAttachments] = useState<any[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState<boolean>(false);
  const [savingResults, setSavingResults] = useState<boolean>(false);
  const [resultsHasChanges, setResultsHasChanges] = useState<boolean>(false);
  
  // File upload state for Attachments tab
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  
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

  // Request action confirmation modals state
  const [showStartConfirmModal, setShowStartConfirmModal] = useState<boolean>(false);
  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState<boolean>(false);
  const [cancellationReason, setCancellationReason] = useState<string>('');
  const [showCompleteConfirmModal, setShowCompleteConfirmModal] = useState<boolean>(false);
  const [showAssignRequestModal, setShowAssignRequestModal] = useState<boolean>(false);
  const [assignRequestData, setAssignRequestData] = useState<{
    assignedUserId: string;
  }>({
    assignedUserId: ''
  });

  // Milestone management state (simplified)
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [milestonesLoading, setMilestonesLoading] = useState<boolean>(false);

  // Handle assign tasks
  const handleAssignTasks = async () => {
    if (!assignTaskData.assignedUserId) {
      toast.error('Please select a user to assign tasks to');
      return;
    }

    try {
      setTaskActionLoading(true);
      const taskIds = Array.from(selectedTasks);
      // Call the existing handleTaskAssign function
      await handleTaskAssign(taskIds, assignTaskData.assignedUserId);
      
      // Close modal and reset data
      setShowAssignTaskModal(false);
      setAssignTaskData({ assignedUserId: '' });
      setSelectedTasks(new Set()); // Clear selection after assignment
      
    } catch (error: any) {
      console.error('Error assigning tasks:', error);
      toast.error('Failed to assign tasks');
    } finally {
      setTaskActionLoading(false);
    }
  };

  // Handle assign request from modal
  const handleAssignRequest = async () => {
    if (!assignRequestData.assignedUserId) {
      toast.error('Please select a user to assign the request to');
      return;
    }

    try {
      setLoading(true);
      
      console.log('🔄 Assigning request:', {
        requestId: request.REQUEST_ID,
        assignedUserId: assignRequestData.assignedUserId
      });
      
      const response = await api.put(`/api/requests/${request.REQUEST_ID}/assign`, { 
        assignedUserId: assignRequestData.assignedUserId
      });
      
      console.log('📝 Assignment response:', response);
      
      if (response.status === 200 || response.data?.success) {
        console.log('✅ Assignment successful, closing modal and refreshing');
        toast.success('Request assigned successfully!');
        
        // Close modal and reset data
        setShowAssignRequestModal(false);
        setAssignRequestData({ assignedUserId: '' });
        
        // Refresh parent component first, then close modal
        await onUpdate();
        // Don't close the main modal - let user see the updated assignment
        // onHide();
      } else {
        console.error('❌ Assignment failed:', response);
        toast.error('Failed to assign request');
      }
    } catch (err: any) {
      console.error('💥 Error during assignment:', err);
      toast.error(err.response?.data?.error || 'Failed to assign request');
    } finally {
      setLoading(false);
    }
  };
  
  // Check if current user can assign requests (processor and above)
  const canAssignRequests = () => {
    if (!currentUser) {
      return false;
    }
    
    // Role IDs that can assign requests: Admin(1), Manager(3), Processor(4), Super Admin(6)
    const assignmentRoles = [1, 3, 4, 6];
    
    // Check if user has roles array (from login API response)
    if (currentUser.roles && Array.isArray(currentUser.roles)) {
      const hasPermission = currentUser.roles.some((role: any) => {
        const roleId = role.id;
        return assignmentRoles.includes(roleId);
      });
      return hasPermission;
    }
    
    // Check roleIds array (from login API response)
    if (currentUser.roleIds && Array.isArray(currentUser.roleIds)) {
      const hasPermission = currentUser.roleIds.some((roleId: number) => 
        assignmentRoles.includes(roleId)
      );
      return hasPermission;
    }
    
    // Check single role (fallback)
    if (currentUser.role) {
      const roleId = parseInt(currentUser.role, 10);
      const hasPermission = assignmentRoles.includes(roleId);
      return hasPermission;
    }
    
    // Check if user has an ID property (temporary fix)
    if (currentUser.id || currentUser.userId) {
      // For now, allow all logged-in users to assign (temporary fix)
      return true;
    }
    
    return false;
  };

  // Memoized permission check to prevent dropdown from disappearing
  const hasAssignPermission = useMemo(() => {
    const permission = canAssignRequests();
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

  // Check if current user is Super Admin (role_id 6)
  const isSuperAdmin = useMemo(() => {
    if (!currentUser) return false;
    
    // Check roles array
    if (currentUser.roles && Array.isArray(currentUser.roles)) {
      return currentUser.roles.some((role: any) => role.id === 6);
    }
    
    // Check roleIds array (if it exists)
    if ((currentUser as any).roleIds && Array.isArray((currentUser as any).roleIds)) {
      return (currentUser as any).roleIds.includes(6);
    }
    
    // Check single role
    if (currentUser.role) {
      return parseInt(currentUser.role, 10) === 6;
    }
    
    return false;
  }, [currentUser]);
  
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
      case 'X': return 'Cancelled';
      default: return 'Unknown';
    }
  };
  
  // Get status badge class
  const getStatusBadgeClass = (status: string) => {
    switch(status) {
      case 'P': return 'badge bg-warning text-dark';
      case 'A': return 'badge bg-primary text-white';
      case 'C': return 'badge bg-success text-white';
      case 'X': return 'badge bg-danger text-white';
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

  // Load form data, tasks, attachments, results and milestones when modal opens.
  // Intentionally excludes hasAssignPermission so user-auth changes don't re-trigger
  // fetches and cause the form fields to flash/disappear.
  useEffect(() => {
    if (show) {
      setFormHasChanges(false);
      fetchFormFieldValues();
      fetchTasks();
      fetchAttachments();
      fetchResults();
      fetchMilestones();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, request.REQUEST_ID]);

  // Fetch users separately so auth changes don't re-trigger the form fetch above
  useEffect(() => {
    if (show && hasAssignPermission) {
      fetchUsers();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (request && request.RESULTS_DESCRIPTION !== null && request.RESULTS_DESCRIPTION !== undefined && request.RESULTS_DESCRIPTION.trim() !== '') {
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
      const response = await api.get('/api/users');
      const userData = response.data?.data || response.data;
      
      if (Array.isArray(userData)) {
        // Show all users for assignment
        const allUsers = userData.filter((user: User) => {
          // Very basic validation - just check if user has an ID
          const hasId = user.USER_ID;
          return hasId; // Only require USER_ID to exist
        });
        
        // If no users after filtering, show all users as fallback
        if (allUsers.length === 0) {
          setUsers(userData);
        } else {
          setUsers(allUsers);
        }
      } else {
        console.error('User data is not an array:', userData);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch form field values for this request
  const fetchFormFieldValues = async () => {
    try {
      setFormLoading(true);
      
      const response = await api.get(`/api/requests/${request.REQUEST_ID}/form`);
      
      if (response.data && response.status === 200) {
        const formData = response.data;
        
        // Set form template information
        if (formData.form) {
          setFormTemplate({
            name: formData.form.FORM_NAME,
            description: formData.form.FORM_DESCRIPTION,
            id: formData.form.FORM_ID
          });
        } else {
          setFormTemplate(null);
        }

        // Store raw field metadata for SectionedFormRenderer
        setFormFields(formData.fields && Array.isArray(formData.fields) ? formData.fields : []);

        // Convert form instance values to display format - ONLY show real database data
        const fieldValues: FormFieldValue[] = [];

        if (formData.fields && Array.isArray(formData.fields)) {
          formData.fields.forEach((field: any) => {
            // Get the actual value - try both field ID and field name as keys
            const valueByName = formData.values?.[field.FIELD_NAME];
            const valueById = formData.values?.[field.FIELD_ID];
            const value = valueByName || valueById;

            fieldValues.push({
              fieldId: field.FIELD_ID,
              fieldName: field.FIELD_NAME,
              fieldValue: value && value.toString().trim() !== ''
                ? value // Real database value from FORMS_INSTANCE_VALUES
                : '' // Empty string for unfilled fields
            });
          });
        }

        setFormFieldValues(fieldValues);
      } else {
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
      
      const response = await api.get(`/api/requests/${request.REQUEST_ID}/tasks`);
      
      if (response.data && response.data.success) {
        const newTasks = response.data.data || [];
        setTasks(newTasks);
      } else {
        setTasks([]);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setTasks([]);
    } finally {
      setTasksLoading(false);
    }
  };

  // Fetch results description for this request
  const fetchResults = async () => {
    try {
      const response = await api.get(`/api/requests`);
      
      if (response.data && Array.isArray(response.data)) {
        const currentRequest = response.data.find((r: any) => r.REQUEST_ID === request.REQUEST_ID);
        if (currentRequest) {
          if (currentRequest.RESULTS_DESCRIPTION !== null && currentRequest.RESULTS_DESCRIPTION !== undefined && currentRequest.RESULTS_DESCRIPTION.trim() !== '') {
            setResultsNotes(currentRequest.RESULTS_DESCRIPTION);
            setResultsHasChanges(false);
          } else {
            setResultsNotes('');
            setResultsHasChanges(false);
          }
        } else {
          setResultsNotes('');
          setResultsHasChanges(false);
        }
      }
    } catch (error) {
      console.error('Error fetching results:', error);
      setResultsNotes('');
      setResultsHasChanges(false);
    }
  };

  // Fetch attachments for this request
  const fetchAttachments = async () => {
    try {
      setAttachmentsLoading(true);
      
      const response = await api.get(`/api/requests/${request.REQUEST_ID}/attachments`);
      
      if (response.data && response.data.success) {
        const attachmentsData = response.data.attachments || [];
        setAttachments(attachmentsData);
      } else {
        setAttachments([]);
      }
    } catch (error) {
      console.error('Error fetching attachments:', error);
      setAttachments([]);
    } finally {
      setAttachmentsLoading(false);
    }
  };

  // Fetch milestones for this request
  const fetchMilestones = async () => {
    try {
      setMilestonesLoading(true);
      
      const response = await api.get(`/api/requests/${request.REQUEST_ID}/milestones`);
      
      if (response.data && response.data.success) {
        const milestonesData = response.data.milestones || [];
        setMilestones(milestonesData);
      } else {
        setMilestones([]);
      }
    } catch (error) {
      console.error('Error fetching milestones:', error);
      setMilestones([]);
    } finally {
      setMilestonesLoading(false);
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
      console.error('Error adding task:', error);
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
      console.error('Error updating tasks:', error);
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
      let successCount = 0;
      for (const taskId of taskIds) {
        try {
          const res = await api.put(`/api/tasks/${taskId}`, { assignedUserId: parseInt(assignedUserId, 10) });
          if (res.data?.success) successCount += 1;
        } catch (err: any) {
          console.error(`Failed to assign task ${taskId}:`, err?.response?.data || err?.message || err);
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
      console.error('Error assigning tasks:', error);
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

  // Helper function to get readable event name
  const getEventName = (milestone: Milestone) => {
    switch (milestone.progressType) {
      case 'status':
        if (milestone.statusFrom && milestone.statusTo) {
          return `Status Changed from ${milestone.statusFrom} to ${milestone.statusTo}`;
        }
        return milestone.title;
      case 'system':
        return milestone.title; // "Submitted", "Assigned", etc.
      case 'task':
        return milestone.title; // "Task Created", "Task Completed", etc.
      case 'document':
        return milestone.title; // "Document Uploaded", etc.
      case 'form':
        return 'Form Submitted';
      case 'note':
        return 'Note Added';
      default:
        return milestone.title;
    }
  };

  // Helper function to format date/time as MM/DD/YYYY, H:MM AM/PM
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const dateStr = date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });
    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    return `${dateStr}, ${timeStr}`;
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

  // Modal is always rendered xl — CSS on .modal.request-modal-improved handles the
  // actual expanded width/height so no async race condition can shrink it.
  const modalSize = 'xl' as const;

  // Stable fieldValues record for SectionedFormRenderer — keyed by String(fieldId)
  const currentFieldValues = useMemo(
    () =>
      formFieldValues.reduce((acc, fv) => {
        acc[String(fv.fieldId)] = fv.fieldValue ?? '';
        return acc;
      }, {} as Record<string, string>),
    [formFieldValues],
  );

  // Adapter: SectionedFormRenderer calls onChange(fieldId, value); map back to fieldName-based handler
  const handleFormFieldChangeById = useCallback(
    (fieldId: string, value: string) => {
      const field = formFieldValues.find(f => String(f.fieldId) === fieldId);
      if (field) handleFieldValueChange(field.fieldName, value);
    },
    [formFieldValues, handleFieldValueChange],
  );

  // Save form data to the server
  const handleSaveFormData = async () => {
    try {
      setIsSavingForm(true);
      
      // Prepare form data in the format the server expects
      // Use the ref to guarantee we read the latest state (avoids stale closure with concurrent updates)
      const fieldValues = formFieldValuesRef.current.reduce((acc, field) => {
        if (field.fieldValue && field.fieldValue.toString().trim() !== '') {
          acc[field.fieldId.toString()] = field.fieldValue;
        }
        return acc;
      }, {} as Record<string, string>);

      const submissionData = {
        fieldValues,
        isComplete: false, // Mark as draft/auto-save
        isDraft: true
      };

      // Submit form data to the correct endpoint
      const response = await api.post(`/api/requests/${request.REQUEST_ID}/form/submit`, submissionData);

      if (response.status === 200 || response.status === 201) {
        setFormHasChanges(false);
        // Refresh the form data
        await fetchFormFieldValues();
        // Ensure any side effects during the fetch don't re-set the flag
        setFormHasChanges(false);
        toast.success('Form data saved successfully');
      } else {
        console.error('Failed to save form data:', response.status);
        toast.error('Failed to save form data. Please try again.');
      }
    } catch (error) {
      console.error('Error saving form data:', error);
      toast.error('Error saving form data. Please try again.');
    } finally {
      setIsSavingForm(false);
    }
  };

  // Handle user assignment
  const handleAssignUser = async () => {
    if (!selectedUser) return;
    
    try {
      setLoading(true);
      
      const response = await api.put(`/api/requests/${request.REQUEST_ID}/assign`, { 
        assignedUserId: selectedUser
      });
      
      if (response.status === 200 || response.data?.success) {
        toast.success('Request assigned successfully!');
        
        // Immediate refresh - no setTimeout needed
        onUpdate();
        onHide();
      } else {
        console.error('Assignment failed:', response);
        toast.error('Failed to assign request');
      }
    } catch (err: any) {
      console.error('Failed to assign user:', err);
      toast.error(err.response?.data?.error || 'Failed to assign request');
    } finally {
      setLoading(false);
    }
  };

  // Work action handlers
  const handleStartWork = async () => {
    try {
      setWorkActionLoading(true);
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

  const handleCancelRequest = async () => {
    if (!cancellationReason.trim() || cancellationReason.trim().length < 10) {
      toast.error('Please provide a cancellation reason of at least 10 characters');
      return;
    }

    try {
      setWorkActionLoading(true);
      await api.post(`/api/requests/${request.REQUEST_ID}/cancel`, {
        cancellationReason: cancellationReason.trim()
      });
      
      toast.success('Request cancelled successfully');
      setCancellationReason(''); // Reset the reason
      setShowCancelConfirmModal(false);
      onUpdate(); // Refresh parent component
      onHide(); // Close modal
    } catch (error: any) {
      console.error('Error cancelling request:', error);
      toast.error(error.response?.data?.error || 'Failed to cancel request');
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
      
      // Save results notes to RESULTS_DESCRIPTION field
      if (resultsNotes.trim()) {
        const descResponse = await api.put(`/api/requests/${request.REQUEST_ID}/description`, {
          description: resultsNotes.trim()
        });
        
        if (!descResponse.data.success) {
          toast.error('Failed to save results');
          return;
        }
      } else {
        // Clear the RESULTS_DESCRIPTION field if notes are empty
        const descResponse = await api.put(`/api/requests/${request.REQUEST_ID}/description`, {
          description: null
        });
        
        if (!descResponse.data.success) {
          toast.error('Failed to clear results');
          return;
        }
      }
      
      toast.success('Results saved successfully!');
      setResultsHasChanges(false);
      onUpdate(); // Refresh parent component
      
    } catch (error: any) {
      console.error('Error saving results:', error);
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
      console.error('Error completing request:', error);
      toast.error(error.response?.data?.error || 'Failed to complete request');
    } finally {
      setSavingResults(false);
    }
  };

  // Handle attachment download
  // File validation function
  const validateFile = (file: File) => {
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    if (file.size > maxSize) {
      toast.error(`File ${file.name} is too large. Maximum size is 10MB.`);
      return false;
    }
    
    return true;
  };

  // Handle files dropped or selected
  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    
    // Handle rejected files
    rejectedFiles.forEach(({ file, errors }) => {
      errors.forEach((error: any) => {
        if (error.code === 'file-too-large') {
          toast.error(`${file.name} is too large. Maximum size is 10MB.`);
        } else if (error.code === 'file-invalid-type') {
          toast.error(`${file.name} has an unsupported file type.`);
        } else {
          toast.error(`Error with ${file.name}: ${error.message}`);
        }
      });
    });
    
    // Add accepted files to selection
    if (acceptedFiles.length > 0) {
      const validFiles = acceptedFiles.filter(validateFile);
      if (validFiles.length > 0) {
        setSelectedFiles(prev => {
          // Prevent duplicates based on file name and size
          const existingFileKeys = prev.map(f => `${f.name}-${f.size}`);
          const newFiles = validFiles.filter(f => !existingFileKeys.includes(`${f.name}-${f.size}`));
          
          if (newFiles.length < validFiles.length) {
            toast.warning(`${validFiles.length - newFiles.length} file(s) already selected`);
          }
          
          return [...prev, ...newFiles];
        });
      }
    }
  }, []);

  // Dropzone configuration
  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragAccept,
    isDragReject
  } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/plain': ['.txt'],
      'text/csv': ['.csv']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: true,
    disabled: uploadingFiles
  });

  // Get dropzone styling based on state
  const getDropzoneStyle = () => {
    let baseStyle = 'border-2 border-dashed rounded p-4 text-center transition-all cursor-pointer';
    
    if (uploadingFiles) {
      return `${baseStyle} border-muted bg-light cursor-not-allowed opacity-50`;
    }
    
    if (isDragAccept) {
      return `${baseStyle} border-success bg-success bg-opacity-10 text-success`;
    }
    
    if (isDragReject) {
      return `${baseStyle} border-danger bg-danger bg-opacity-10 text-danger`;
    }
    
    if (isDragActive) {
      return `${baseStyle} border-primary bg-primary bg-opacity-10 text-primary`;
    }
    
    return `${baseStyle} border-secondary text-muted hover:border-primary hover:text-primary`;
  };

  // Remove file from selection
  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Upload selected files
  const handleUploadFiles = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Please select files to upload');
      return;
    }

    try {
      setUploadingFiles(true);
      
      let successCount = 0;
      const totalFiles = selectedFiles.length;
      
      // Upload files one by one to avoid overwhelming the server
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('requestId', request.REQUEST_ID.toString());
        
        try {
          setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));
          
          const response = await api.post(`/api/requests/${request.REQUEST_ID}/attachments`, formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
            onUploadProgress: (progressEvent) => {
              if (progressEvent.total) {
                const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                setUploadProgress(prev => ({ ...prev, [file.name]: progress }));
              }
            }
          });
          
          if (response.data && response.data.success) {
            successCount++;
            setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));
          } else {
            console.error(`Failed to upload ${file.name}:`, response.data);
            toast.error(`Failed to upload ${file.name}`);
          }
        } catch (error: any) {
          console.error(`Error uploading ${file.name}:`, error);
          toast.error(`Failed to upload ${file.name}: ${error.response?.data?.error || error.message}`);
        }
        
        // Small delay between uploads
        if (i < selectedFiles.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      // Show results
      if (successCount === totalFiles) {
        toast.success(`Successfully uploaded ${successCount} file${successCount !== 1 ? 's' : ''}!`);
      } else if (successCount > 0) {
        toast.warning(`Uploaded ${successCount} of ${totalFiles} files`);
      } else {
        toast.error('No files were uploaded successfully');
      }
      
      // Clear selected files and refresh attachments
      setSelectedFiles([]);
      setUploadProgress({});
      await fetchAttachments();
      
    } catch (error: any) {
      console.error('Error during file upload:', error);
      toast.error('An error occurred during file upload');
    } finally {
      setUploadingFiles(false);
      setUploadProgress({});
    }
  };

  // Handle attachment deletion
  const handleDeleteAttachment = async (attachmentId: number, fileName: string) => {
    if (!confirm(`Are you sure you want to delete ${fileName}?`)) {
      return;
    }

    try {
      
      const response = await api.delete(`/api/attachments/${attachmentId}`);
      
      if (response.data && response.data.success) {
        toast.success(`Deleted ${fileName}`);
        await fetchAttachments(); // Refresh attachments list
      } else {
        toast.error('Failed to delete attachment');
      }
    } catch (error: any) {
      console.error('Error deleting attachment:', error);
      toast.error(error.response?.data?.error || 'Failed to delete attachment');
    }
  };

  const handleDownloadAttachment = async (attachmentId: number, fileName: string) => {
    try {
      
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
      
    } catch (error: any) {
      console.error('Error downloading attachment:', error);
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
    <Modal
      show={show}
      onHide={onHide}
      size={modalSize}
      centered
      className="request-modal-improved"
    >
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
                activeMainTab === 'attachments' ? 'text-primary border-bottom border-primary border-2' : 'text-muted'
              }`}
              onClick={() => setActiveMainTab('attachments')}
              style={{ fontSize: '1rem', fontWeight: activeMainTab === 'attachments' ? '600' : '400' }}
            >
              Attachments
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
        <div className="tab-content">
          
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
          <SectionedFormRenderer
            formName={formTemplate?.name ?? ''}
            fields={formFields}
            fieldValues={currentFieldValues}
            onChange={handleFormFieldChangeById}
            readOnly={request.STATUS === 'C'}
          />
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

              {/* Action Buttons Row */}
              <div className="border-top pt-4 mt-4">
                <h6 className="mb-3 fw-semibold">Action Buttons Row</h6>
                
                <div className="d-flex gap-2 flex-wrap mb-3">
                  {/* 1. Assign Button - Always show for users with permission */}
                  {hasAssignPermission && (
                    <Button 
                      variant="outline-primary"
                      onClick={() => setShowAssignRequestModal(true)}
                      disabled={loading}
                      style={{ minWidth: '80px' }}
                    >
                      Assign
                    </Button>
                  )}

                  {/* 2. Start Button - Show for pending requests when user has permission, Super Admin sees all */}
                  {(isSuperAdmin) || ((request.STATUS === 'P') && (hasAssignPermission || canWorkOnRequest || isRequestorUser)) ? (
                    <Button 
                      variant="success"
                      onClick={() => setShowStartConfirmModal(true)}
                      disabled={workActionLoading}
                      style={{ minWidth: '80px' }}
                    >
                      Start
                    </Button>
                  ) : null}
                  
                  {/* 3. Complete Button - Show for assigned user, Processor, Manager, Admin when status is In Progress, Super Admin sees all */}
                  {(isSuperAdmin) || ((request.STATUS === 'A') && (isAssignedToCurrentUser || canWorkOnRequest)) ? (
                    <Button 
                      variant="primary"
                      onClick={() => {
                        if (!resultsNotes.trim()) {
                          toast.error('Please add results in the Results tab before completing the request');
                          setActiveMainTab('results');
                          return;
                        }
                        setShowCompleteConfirmModal(true);
                      }}
                      disabled={workActionLoading}
                      style={{ minWidth: '80px' }}
                    >
                      Complete
                    </Button>
                  ) : null}
                  
                  {/* 4. Cancel Button - Show for Processor, Manager, Admin when status is Pending or In Progress, Super Admin sees all */}
                  {(isSuperAdmin) || ((request.STATUS === 'P' || request.STATUS === 'A') && canWorkOnRequest) ? (
                    <Button 
                      variant="danger"
                      onClick={() => setShowCancelConfirmModal(true)}
                      disabled={workActionLoading}
                      style={{ minWidth: '80px' }}
                    >
                      Cancel
                    </Button>
                  ) : null}
                </div>


                <div className="d-flex justify-content-end">
                  <Button 
                    variant="outline-secondary" 
                    onClick={onHide} 
                    size="sm"
                    className="px-3"
                  >
                    Close
                  </Button>
                </div>
              </div>
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
                      variant="outline-primary"
                      onClick={() => setShowAddTaskModal(true)}
                      disabled={taskActionLoading}
                    >
                      Add Task
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline-secondary"
                      onClick={() => setShowAssignTaskModal(true)}
                      disabled={taskActionLoading || selectedTasks.size === 0}
                    >
                      Assign Tasks
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline-success"
                      onClick={() => handleTaskStatusUpdate(Array.from(selectedTasks), 'In Progress')}
                      disabled={taskActionLoading || selectedTasks.size === 0}
                    >
                      Start Tasks
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline-success"
                      onClick={() => handleTaskStatusUpdate(Array.from(selectedTasks), 'Completed')}
                      disabled={taskActionLoading || selectedTasks.size === 0}
                    >
                      Complete Tasks
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline-danger"
                      onClick={() => handleTaskStatusUpdate(Array.from(selectedTasks), 'Cancelled')}
                      disabled={taskActionLoading || selectedTasks.size === 0}
                    >
                      Cancel Tasks
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
                          <th style={{ width: '50px' }}>
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

          {/* Attachments Tab */}
          {activeMainTab === 'attachments' && (
            <div className="tab-pane active">
              <div className="mb-4">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h6 className="mb-0 fw-semibold">Document Management</h6>
                  <div className="d-flex gap-2">
                    <span className="badge bg-secondary">
                      {attachmentsLoading ? 'Loading...' : `${attachments.length} document${attachments.length !== 1 ? 's' : ''}`}
                    </span>
                    <Button 
                      size="sm" 
                      variant="primary" 
                      className="d-flex align-items-center"
                      onClick={handleUploadFiles}
                      disabled={uploadingFiles || selectedFiles.length === 0}
                    >
                      <Upload size={14} className="me-1" />
                      {uploadingFiles ? 'Uploading...' : `Upload ${selectedFiles.length > 0 ? `(${selectedFiles.length})` : 'Documents'}`}
                    </Button>
                  </div>
                </div>

                {/* File Upload Section */}
                <div className="card mb-4">
                  <div className="card-header bg-light">
                    <h6 className="mb-0 fw-medium">Upload Support Documents</h6>
                  </div>
                  <div className="card-body">
                    {/* React Dropzone Upload Area */}
                    <div className="mb-3">
                      <div {...getRootProps()} className={getDropzoneStyle()}>
                        <input {...getInputProps()} />
                        <div className="py-3">
                          {uploadingFiles ? (
                            <>
                              <div className="spinner-border spinner-border-sm mb-2" role="status">
                                <span className="visually-hidden">Uploading...</span>
                              </div>
                              <div className="fw-medium">Uploading files...</div>
                              <div className="small text-muted">Please wait while files are being uploaded</div>
                            </>
                          ) : isDragActive ? (
                            isDragAccept ? (
                              <>
                                <Upload size={32} className="mb-2 text-success" />
                                <div className="fw-medium text-success">Drop files here to upload</div>
                                <div className="small text-success">Release to add files to upload queue</div>
                              </>
                            ) : (
                              <>
                                <X size={32} className="mb-2 text-danger" />
                                <div className="fw-medium text-danger">Some files are not supported</div>
                                <div className="small text-danger">Only images, PDF, DOC/DOCX, XLS/XLSX, and TXT files are allowed</div>
                              </>
                            )
                          ) : (
                            <>
                              <Upload size={32} className="mb-2" />
                              <div className="fw-medium">Drag & drop files here, or click to browse</div>
                              <div className="small text-muted mt-1">
                                Supported formats: Images, PDF, Word documents, Excel files, Text files (Max 10MB each)
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Selected Files Preview */}
                    {selectedFiles.length > 0 && (
                      <div className="mb-3">
                        <h6 className="fw-medium mb-2">Selected Files ({selectedFiles.length})</h6>
                        <div className="row g-2">
                          {selectedFiles.map((file, index) => (
                            <div key={index} className="col-md-6">
                              <div className="border rounded p-2 d-flex justify-content-between align-items-center bg-light">
                                <div className="d-flex align-items-start flex-grow-1 min-w-0">
                                  <FileText size={16} className="text-primary me-2 flex-shrink-0 mt-1" />
                                  <div className="flex-grow-1 min-w-0">
                                    <div className="fw-medium text-truncate" title={file.name} style={{ fontSize: '0.85rem' }}>
                                      {file.name}
                                    </div>
                                    <div className="text-muted small">
                                      {(file.size / 1024 / 1024).toFixed(2)} MB • {file.type || 'Unknown type'}
                                    </div>
                                    {uploadProgress[file.name] !== undefined && (
                                      <>
                                        <div className="progress mt-1" style={{ height: '6px' }}>
                                          <div 
                                            className="progress-bar progress-bar-striped progress-bar-animated" 
                                            style={{ width: `${uploadProgress[file.name]}%` }}
                                          ></div>
                                        </div>
                                        <div className="small text-muted mt-1">
                                          {uploadProgress[file.name]}% uploaded
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <Button
                                  variant="outline-danger"
                                  size="sm"
                                  className="ms-2 d-flex align-items-center"
                                  onClick={() => removeSelectedFile(index)}
                                  disabled={uploadingFiles}
                                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                                  title="Remove file"
                                >
                                  <X size={12} />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        {uploadingFiles && (
                          <div className="alert alert-info mt-2 py-2" style={{ fontSize: '0.85rem' }}>
                            <div className="d-flex align-items-center">
                              <div className="spinner-border spinner-border-sm me-2" role="status"></div>
                              Uploading files... Please do not close this window.
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="alert alert-info py-2" style={{ fontSize: '0.85rem' }}>
                      <strong>Upload Guidelines:</strong>
                      <ul className="mb-0 mt-1 ps-3">
                        <li>Maximum file size: 10MB per file</li>
                        <li>Supported formats: PDF, DOC/DOCX, XLS/XLSX, TXT, Images (JPG/PNG)</li>
                        <li>Files will be associated with this specific request</li>
                        <li>All uploaded documents will be visible to request participants</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Existing Attachments */}
                <div className="card">
                  <div className="card-header bg-light d-flex justify-content-between align-items-center">
                    <h6 className="mb-0 fw-medium">Request Documents</h6>
                    <Button size="sm" variant="outline-secondary" className="d-flex align-items-center">
                      <Download size={14} className="me-1" />
                      Download All
                    </Button>
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
                          <div key={attachment.attachmentId} className="col-md-6 col-lg-4">
                            <div className="border rounded p-3 h-100 d-flex flex-column">
                              <div className="d-flex align-items-start mb-2">
                                <FileText size={20} className="text-primary me-2 flex-shrink-0 mt-1" />
                                <div className="flex-grow-1 min-w-0">
                                  <h6 className="mb-1 fw-medium text-truncate" title={attachment.fileName}>
                                    {attachment.fileName}
                                  </h6>
                                  <div className="text-muted small">
                                    <div>By: {attachment.uploadedBy.firstName} {attachment.uploadedBy.lastName}</div>
                                    <div>Date: {formatDate(attachment.createDate)}</div>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="mt-auto d-flex gap-2">
                                <Button
                                  variant="outline-primary"
                                  size="sm"
                                  onClick={() => handleDownloadAttachment(attachment.attachmentId, attachment.fileName)}
                                  className="d-flex align-items-center flex-grow-1"
                                >
                                  <Download size={12} className="me-1" />
                                  Download
                                </Button>
                                {canWorkOnRequest && (
                                  <Button
                                    variant="outline-danger"
                                    size="sm"
                                    onClick={() => handleDeleteAttachment(attachment.attachmentId, attachment.fileName)}
                                    title="Delete document"
                                  >
                                    ×
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-5">
                        <Upload size={48} className="text-muted mb-3" />
                        <h6 className="text-muted mb-2">No Documents Yet</h6>
                        <p className="text-muted small mb-3">
                          No documents have been uploaded for this request. Use the upload section above to add supporting files.
                        </p>
                        <div {...getRootProps()} className="cursor-pointer">
                          <input {...getInputProps()} />
                          <Button 
                            variant="outline-primary" 
                            size="sm" 
                            className="d-flex align-items-center mx-auto"
                            as="div"
                            style={{ cursor: 'pointer' }}
                          >
                            <Upload size={14} className="me-1" />
                            Upload First Document
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
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
              <h6 className="mb-3">Milestones</h6>
              {milestonesLoading ? (
                <div className="text-center py-4">
                  <div className="spinner-border spinner-border-sm text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <div className="mt-2 text-muted small">Loading milestones...</div>
                </div>
              ) : milestones.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-muted">No milestones found for this request.</p>
                </div>
              ) : (
                <table className="table table-bordered">
                  <thead>
                    <tr>
                      <th>Event</th>
                      <th>Date/Time</th>
                      <th>By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {milestones
                      .sort((a, b) => new Date(b.createDate).getTime() - new Date(a.createDate).getTime())
                      .map((milestone) => (
                      <tr key={milestone.workProgressId}>
                        <td>{getEventName(milestone)}</td>
                        <td>{formatDateTime(milestone.createDate)}</td>
                        <td>{`${milestone.user.firstName} ${milestone.user.lastName}`.trim()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
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

      {/* Start Request Confirmation Modal */}
      <Modal show={showStartConfirmModal} onHide={() => setShowStartConfirmModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Start Confirmation</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Are you sure you want to start this request?</p>
        </Modal.Body>
        <Modal.Footer>
          <Button 
            variant="secondary" 
            onClick={() => setShowStartConfirmModal(false)}
            disabled={workActionLoading}
          >
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={async () => {
              setShowStartConfirmModal(false);
              await handleStartWork();
            }}
            disabled={workActionLoading}
          >
            {workActionLoading ? 'Starting...' : 'Confirm'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Cancel Request Form Modal */}
      <Modal 
        show={showCancelConfirmModal} 
        onHide={() => {
          if (!workActionLoading) {
            setShowCancelConfirmModal(false);
            setCancellationReason('');
          }
        }} 
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title className="text-danger">Cancel Request</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="mb-3">
            <h6 className="text-muted mb-2">Request Details:</h6>
            <div className="bg-light p-3 rounded mb-3">
              <div><strong>ID:</strong> {request.TRACKINGID || request.REQUEST_ID}</div>
              <div><strong>Name:</strong> {request.REQUEST_NAME}</div>
              <div><strong>Current Status:</strong> <span className="badge bg-info">{request.STATUS}</span></div>
            </div>
          </div>
          
          <div className="mb-3">
            <label className="form-label">
              Cancellation Reason <span className="text-danger">*</span>
            </label>
            <textarea
              className={`form-control ${
                cancellationReason.trim().length > 0 && cancellationReason.trim().length < 10 
                  ? 'is-invalid' 
                  : cancellationReason.trim().length >= 10 
                  ? 'is-valid' 
                  : ''
              }`}
              rows={4}
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              placeholder="Please provide a detailed reason for cancelling this request. This information will be recorded for audit purposes."
              maxLength={500}
              required
              disabled={workActionLoading}
            />
            <div className="d-flex justify-content-between mt-1">
              <small className="text-muted">
                Minimum 10 characters required
              </small>
              <small className={`${
                cancellationReason.length > 450 ? 'text-warning' : 'text-muted'
              }`}>
                {cancellationReason.length}/500 characters
              </small>
            </div>
            {cancellationReason.trim().length > 0 && cancellationReason.trim().length < 10 && (
              <div className="invalid-feedback d-block">
                Please provide at least 10 characters explaining the cancellation reason.
              </div>
            )}
          </div>
          
          <div className="alert alert-warning">
            <small>
              <strong>Warning:</strong> Cancelling this request will permanently change its status. 
              This action cannot be undone and will be recorded in the audit trail.
            </small>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button 
            variant="secondary" 
            onClick={() => {
              setShowCancelConfirmModal(false);
              setCancellationReason('');
            }}
            disabled={workActionLoading}
          >
            Cancel
          </Button>
          <Button 
            variant="danger" 
            onClick={handleCancelRequest}
            disabled={!cancellationReason.trim() || cancellationReason.trim().length < 10 || workActionLoading}
          >
            {workActionLoading ? 'Cancelling...' : 'Cancel Request'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Complete Request Confirmation Modal */}
      <Modal show={showCompleteConfirmModal} onHide={() => setShowCompleteConfirmModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="text-success">Complete Request</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Are you sure you want to complete this request?</p>
          <div className="alert alert-info">
            <small>Available from Results tab after saving results</small>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button 
            variant="secondary" 
            onClick={() => setShowCompleteConfirmModal(false)}
            disabled={workActionLoading}
          >
            Cancel
          </Button>
          <Button 
            variant="success" 
            onClick={async () => {
              setShowCompleteConfirmModal(false);
              await handleCompleteWork();
            }}
            disabled={workActionLoading}
          >
            {workActionLoading ? 'Completing...' : 'Complete Request'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Assign Request Modal */}
      <Modal show={showAssignRequestModal} onHide={() => setShowAssignRequestModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Assign Request</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="mb-3">
            <div className="alert alert-info py-2">
              <small>
                <strong>Assign this request to a user</strong>
                <br />
                Select a user who will be responsible for processing this request.
              </small>
            </div>
          </div>
          
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Assign To *</Form.Label>
              <Form.Select
                value={assignRequestData.assignedUserId}
                onChange={(e) => setAssignRequestData({...assignRequestData, assignedUserId: e.target.value})}
                required
              >
                <option value="">Select a user to assign request to...</option>
                {users.map((user) => (
                  <option key={user.USER_ID} value={user.USER_ID}>
                    {user.FULL_NAME} ({user.ROLE_NAMES})
                  </option>
                ))}
              </Form.Select>
              <Form.Text className="text-muted">
                Choose a user who will be responsible for processing this request
              </Form.Text>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button 
            variant="secondary" 
            onClick={() => {
              setShowAssignRequestModal(false);
              setAssignRequestData({ assignedUserId: '' });
            }}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleAssignRequest}
            disabled={loading || !assignRequestData.assignedUserId}
          >
            {loading ? 'Assigning...' : 'Assign Request'}
          </Button>
        </Modal.Footer>
      </Modal>

    </Modal>
  );
};

export default RequestModal;