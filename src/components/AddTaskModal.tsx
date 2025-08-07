import React, { useState, useEffect } from 'react';
import { Modal, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { toast } from 'react-toastify';
import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';

interface User {
  USER_ID: number;
  FIRST_NAME: string;
  LAST_NAME: string;
  EMAIL: string;
}

interface AddTaskModalProps {
  show: boolean;
  onHide: () => void;
  requestId: number;
  onSuccess: () => void;
}

const AddTaskModal: React.FC<AddTaskModalProps> = ({
  show,
  onHide,
  requestId,
  onSuccess
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    assignedUserId: '',
    description: ''
  });

  // Load users when modal opens
  useEffect(() => {
    if (show) {
      loadUsers();
      // Reset form
      setFormData({
        assignedUserId: '',
        description: ''
      });
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (error) {
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.description.trim()) {
      setError('Task description is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const taskData = {
        requestId,
        assignedUserId: formData.assignedUserId ? parseInt(formData.assignedUserId) : null,
        description: formData.description.trim(),
        status: 'Pending'
      };

      await api.post('/api/tasks', taskData);
      
      toast.success('Task created successfully');
      onSuccess();
    } catch (error: any) {
      console.error('Failed to create task:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to create task';
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

  return (
    <Modal show={show} onHide={handleClose} backdrop="static" size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Add New Task</Modal.Title>
      </Modal.Header>
      
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          {error && (
            <Alert variant="danger" className="mb-3">
              {error}
            </Alert>
          )}

          <div className="mb-4">
            <Form.Group className="mb-3">
              <Form.Label>Assigned To</Form.Label>
              {loadingUsers ? (
                <div className="d-flex align-items-center">
                  <Spinner animation="border" size="sm" className="me-2" />
                  <span>Loading users...</span>
                </div>
              ) : (
                <Form.Select
                  name="assignedUserId"
                  value={formData.assignedUserId}
                  onChange={handleInputChange}
                  disabled={loading}
                >
                  <option value="">UNASSIGNED</option>
                  {users.map(user => (
                    <option key={user.USER_ID} value={user.USER_ID}>
                      {user.FIRST_NAME} {user.LAST_NAME} ({user.EMAIL})
                    </option>
                  ))}
                </Form.Select>
              )}
              <Form.Text className="text-muted">
                Leave unassigned or select a user to assign this task to.
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>
                Task Description <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={4}
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Enter a detailed description of the task..."
                required
                disabled={loading}
                maxLength={250}
              />
              <Form.Text className="text-muted">
                {formData.description.length}/250 characters
              </Form.Text>
            </Form.Group>
          </div>
        </Modal.Body>

        <Modal.Footer>
          <Button 
            variant="secondary" 
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button 
            variant="primary" 
            type="submit"
            disabled={loading || !formData.description.trim()}
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
                Creating...
              </>
            ) : (
              'Add Task'
            )}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default AddTaskModal;