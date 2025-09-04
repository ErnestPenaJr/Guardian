import React, { useState, useEffect } from 'react';
import { Modal, Form, Button, Alert, Spinner, Badge } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { User, CheckSquare } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';

interface Task {
  TASK_ID: number;
  REQUEST_ID: number;
  STATUS: string;
  ASSIGNED_USER_ID: number | null;
  DESCRIPTION: string;
  CREATE_DATE: string;
  UPDATE_DATE: string;
  TRACKINGID: string;
  assignedUser?: {
    FIRST_NAME: string;
    LAST_NAME: string;
    EMAIL: string;
  };
  createdBy?: {
    FIRST_NAME: string;
    LAST_NAME: string;
    EMAIL: string;
  };
}

interface User {
  USER_ID: number;
  FIRST_NAME: string;
  LAST_NAME: string;
  EMAIL: string;
}

interface AssignTaskModalProps {
  show: boolean;
  onHide: () => void;
  selectedTasks: Task[];
  onAssign: (assignedUserId: number | null, tasks: Task[]) => void;
}

const AssignTaskModal: React.FC<AssignTaskModalProps> = ({
  show,
  onHide,
  selectedTasks,
  onAssign
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  // Load users when modal opens
  useEffect(() => {
    if (show) {
      loadUsers();
      // Reset form
      setSelectedUserId('');
      setError(null);
    }
  }, [show]);

  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      const response = await api.get('/api/users');
      if (response.data && Array.isArray(response.data)) {
        setUsers(response.data);
      } else if (response.data?.users && Array.isArray(response.data.users)) {
        setUsers(response.data.users);
      } else {
        setUsers([]);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
      toast.error('Failed to load users');
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedTasks.length === 0) {
      setError('No tasks selected for assignment');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const assignedUserId = selectedUserId ? parseInt(selectedUserId) : null;
      
      // Call the parent component's onAssign function
      await onAssign(assignedUserId, selectedTasks);
      
      // Close modal on successful assignment
      onHide();
    } catch (error: any) {
      console.error('Failed to assign tasks:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to assign tasks';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onHide();
    }
  };

  const getSelectedUserName = () => {
    if (!selectedUserId) return 'UNASSIGNED';
    const user = users.find(u => u.USER_ID.toString() === selectedUserId);
    return user ? `${user.FIRST_NAME} ${user.LAST_NAME}` : 'Unknown User';
  };

  return (
    <Modal show={show} onHide={handleClose} backdrop="static" size="lg">
      <Modal.Header closeButton>
        <Modal.Title>
          <User size={20} className="me-2" />
          Assign Tasks
        </Modal.Title>
      </Modal.Header>
      
      <Form onSubmit={handleAssign}>
        <Modal.Body>
          {error && (
            <Alert variant="danger" className="mb-3">
              {error}
            </Alert>
          )}

          {/* Tasks being assigned */}
          <div className="mb-4">
            <h6 className="mb-3">Tasks to Assign ({selectedTasks.length})</h6>
            <div className="bg-light rounded p-3 mb-4" style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {selectedTasks.length === 0 ? (
                <div className="text-muted text-center py-3">
                  No tasks selected
                </div>
              ) : (
                <div className="row g-2">
                  {selectedTasks.map(task => (
                    <div key={task.TASK_ID} className="col-12">
                      <div className="d-flex align-items-start p-2 border rounded bg-white">
                        <CheckSquare size={16} className="text-primary me-2 mt-1 flex-shrink-0" />
                        <div className="flex-grow-1 min-w-0">
                          <div className="d-flex align-items-center mb-1">
                            <Badge bg="primary" className="me-2 text-xs">
                              #{task.TRACKINGID || task.TASK_ID}
                            </Badge>
                            <Badge 
                              bg={task.STATUS === 'Pending' ? 'warning' : task.STATUS === 'In Progress' ? 'primary' : 'secondary'}
                              className="text-xs"
                            >
                              {task.STATUS}
                            </Badge>
                          </div>
                          <div className="text-sm text-truncate" title={task.DESCRIPTION}>
                            {task.DESCRIPTION || 'No description'}
                          </div>
                          {task.assignedUser && (
                            <div className="text-muted text-xs mt-1">
                              Currently assigned to: {task.assignedUser.FIRST_NAME} {task.assignedUser.LAST_NAME}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* User selection */}
          <div className="mb-4">
            <Form.Group>
              <Form.Label className="fw-medium">
                Assign To
              </Form.Label>
              {loadingUsers ? (
                <div className="d-flex align-items-center p-3 border rounded bg-light">
                  <Spinner animation="border" size="sm" className="me-2" />
                  <span>Loading users...</span>
                </div>
              ) : (
                <>
                  <Form.Select
                    value={selectedUserId}
                    onChange={(e) => {
                      setSelectedUserId(e.target.value);
                      setError(null);
                    }}
                    disabled={loading || selectedTasks.length === 0}
                    className="mb-2"
                  >
                    <option value="">UNASSIGNED</option>
                    {users.map(user => (
                      <option key={user.USER_ID} value={user.USER_ID}>
                        {user.FIRST_NAME} {user.LAST_NAME} ({user.EMAIL})
                      </option>
                    ))}
                  </Form.Select>
                  <Form.Text className="text-muted">
                    Select a user to assign all selected tasks to, or leave unassigned.
                  </Form.Text>
                </>
              )}
            </Form.Group>
          </div>

          {/* Assignment summary */}
          {selectedTasks.length > 0 && (
            <div className="bg-info bg-opacity-10 border border-info rounded p-3">
              <div className="d-flex align-items-center">
                <CheckSquare size={16} className="text-info me-2" />
                <strong className="text-info">Assignment Summary</strong>
              </div>
              <div className="mt-2 text-sm">
                <div>
                  <strong>{selectedTasks.length}</strong> task(s) will be assigned to: <strong>{getSelectedUserName()}</strong>
                </div>
                {selectedUserId && (
                  <div className="text-muted mt-1">
                    Email notifications will be sent to the assigned user.
                  </div>
                )}
              </div>
            </div>
          )}
        </Modal.Body>

        <Modal.Footer className="d-flex justify-content-between">
          <div className="text-muted small">
            {selectedTasks.length} task(s) selected
          </div>
          <div className="d-flex gap-2">
            <Button 
              variant="outline-secondary" 
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button 
              variant="primary" 
              type="submit"
              disabled={loading || selectedTasks.length === 0 || loadingUsers}
            >
              {loading ? (
                <>
                  <Spinner
                    as="span"
                    animation="border"
                    size="sm"
                    role="status"
                    aria-hidden="true"
                    className="me-2"
                  />
                  Assigning...
                </>
              ) : (
                <>
                  <User size={16} className="me-1" />
                  Assign {selectedTasks.length} Task{selectedTasks.length !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </div>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default AssignTaskModal;