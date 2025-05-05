import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import { 
  PermissionType, 
  ResourceType, 
  Permission, 
  Role,
  PERMISSIONS,
  PREDEFINED_ROLES
} from '../../server/models/permissions';
import { Container, Row, Col, Card, Table, Form, Button, Alert, Spinner, Tab, Tabs } from 'react-bootstrap';
import { FaSave, FaUndo, FaPlus, FaTrash, FaUserShield } from 'react-icons/fa';

const AdminRolePermissions: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('roles');
  const [newRole, setNewRole] = useState<Partial<Role>>({
    name: '',
    displayName: '',
    description: '',
    permissions: []
  });

  // Group permissions by resource type for better UI organization
  const groupedPermissions = PERMISSIONS.reduce((acc, permission) => {
    const resource = permission.resource;
    if (!acc[resource]) {
      acc[resource] = [];
    }
    acc[resource].push(permission);
    return acc;
  }, {} as Record<ResourceType, Permission[]>);

  useEffect(() => {
    // Fetch roles from the API
    const fetchRoles = async () => {
      try {
        setLoading(true);
        const response = await api.get('/roles');
        
        // If no roles exist yet, use predefined roles
        if (response.data.length === 0) {
          setRoles(PREDEFINED_ROLES);
        } else {
          setRoles(response.data);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching roles:', err);
        setError('Failed to load roles. Please try again.');
        setLoading(false);
      }
    };

    fetchRoles();
  }, []);

  // Handle role selection
  const handleRoleSelect = (roleId: number) => {
    const role = roles.find(r => r.id === roleId);
    if (role) {
      setSelectedRole(role);
      setError(null);
      setSuccess(null);
    }
  };

  // Handle permission toggle
  const handlePermissionToggle = (permissionId: number) => {
    if (!selectedRole) return;

    const updatedPermissions = selectedRole.permissions.includes(permissionId)
      ? selectedRole.permissions.filter(id => id !== permissionId)
      : [...selectedRole.permissions, permissionId];

    setSelectedRole({
      ...selectedRole,
      permissions: updatedPermissions
    });
  };

  // Handle save role
  const handleSaveRole = async () => {
    if (!selectedRole) return;

    try {
      setSaving(true);
      setError(null);
      
      // Update role in the database
      await api.put(`/roles/${selectedRole.id}`, selectedRole);
      
      // Update roles in state
      setRoles(roles.map(role => 
        role.id === selectedRole.id ? selectedRole : role
      ));
      
      setSuccess('Role permissions saved successfully');
      setSaving(false);
    } catch (err) {
      console.error('Error saving role:', err);
      setError('Failed to save role permissions. Please try again.');
      setSaving(false);
    }
  };

  // Handle create new role
  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newRole.name || !newRole.displayName) {
      setError('Role name and display name are required');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      
      // Create role in the database
      const response = await api.post('/roles', newRole);
      const createdRole = response.data;
      
      // Add new role to state
      setRoles([...roles, createdRole]);
      
      // Reset new role form
      setNewRole({
        name: '',
        displayName: '',
        description: '',
        permissions: []
      });
      
      setSuccess('New role created successfully');
      setSaving(false);
      
      // Switch to roles tab and select the new role
      setActiveTab('roles');
      setSelectedRole(createdRole);
    } catch (err) {
      console.error('Error creating role:', err);
      setError('Failed to create new role. Please try again.');
      setSaving(false);
    }
  };

  // Handle new role permission toggle
  const handleNewRolePermissionToggle = (permissionId: number) => {
    const permissions = newRole.permissions || [];
    
    const updatedPermissions = permissions.includes(permissionId)
      ? permissions.filter(id => id !== permissionId)
      : [...permissions, permissionId];

    setNewRole({
      ...newRole,
      permissions: updatedPermissions
    });
  };

  // Check if user is authorized to access this page
  if (user && !user.roles?.includes(1)) {
    return (
      <Container className="mt-5">
        <Alert variant="danger">
          <h4>Access Denied</h4>
          <p>You do not have permission to access this page. This page is restricted to administrators only.</p>
          <Button variant="primary" onClick={() => navigate('/')}>Return to Dashboard</Button>
        </Alert>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '70vh' }}>
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </Container>
    );
  }

  return (
    <Container fluid className="mt-4">
      <h2 className="mb-4">
        <FaUserShield className="me-2" />
        Role & Permission Management
      </h2>
      
      <Tabs
        activeKey={activeTab}
        onSelect={(k) => k && setActiveTab(k)}
        className="mb-4"
      >
        <Tab eventKey="roles" title="Manage Roles">
          <Row>
            <Col md={3}>
              <Card className="mb-4">
                <Card.Header>Roles</Card.Header>
                <Card.Body>
                  <div className="list-group">
                    {roles.map(role => (
                      <Button
                        key={role.id}
                        variant="outline-primary"
                        className={`list-group-item list-group-item-action ${selectedRole?.id === role.id ? 'active' : ''}`}
                        onClick={() => handleRoleSelect(role.id)}
                      >
                        {role.displayName}
                      </Button>
                    ))}
                  </div>
                </Card.Body>
              </Card>
            </Col>
            
            <Col md={9}>
              {selectedRole ? (
                <Card>
                  <Card.Header>
                    <div className="d-flex justify-content-between align-items-center">
                      <h5 className="mb-0">{selectedRole.displayName} Permissions</h5>
                      <div>
                        <Button 
                          variant="success" 
                          size="sm" 
                          className="me-2"
                          onClick={handleSaveRole}
                          disabled={saving}
                        >
                          <FaSave className="me-1" />
                          {saving ? 'Saving...' : 'Save Changes'}
                        </Button>
                        <Button 
                          variant="outline-secondary" 
                          size="sm"
                          onClick={() => handleRoleSelect(selectedRole.id)}
                          disabled={saving}
                        >
                          <FaUndo className="me-1" />
                          Reset
                        </Button>
                      </div>
                    </div>
                  </Card.Header>
                  <Card.Body>
                    {error && <Alert variant="danger">{error}</Alert>}
                    {success && <Alert variant="success">{success}</Alert>}
                    
                    <div className="mb-3">
                      <strong>Role ID:</strong> {selectedRole.id}<br />
                      <strong>Internal Name:</strong> {selectedRole.name}<br />
                      <strong>Description:</strong> {selectedRole.description || 'No description'}
                    </div>
                    
                    <h6 className="mb-3">Permission Settings</h6>
                    
                    {Object.entries(groupedPermissions).map(([resource, permissions]) => (
                      <div key={resource} className="mb-4">
                        <h6 className="border-bottom pb-2">{resource.charAt(0).toUpperCase() + resource.slice(1).replace('_', ' ')} Permissions</h6>
                        <Table striped bordered hover size="sm">
                          <thead>
                            <tr>
                              <th>Permission</th>
                              <th>Description</th>
                              <th style={{ width: '100px' }}>Enabled</th>
                            </tr>
                          </thead>
                          <tbody>
                            {permissions.map(permission => (
                              <tr key={permission.id}>
                                <td>{permission.type.charAt(0).toUpperCase() + permission.type.slice(1)}</td>
                                <td>{permission.description}</td>
                                <td className="text-center">
                                  <Form.Check
                                    type="switch"
                                    id={`permission-${permission.id}`}
                                    checked={selectedRole.permissions.includes(permission.id)}
                                    onChange={() => handlePermissionToggle(permission.id)}
                                    disabled={selectedRole.id === 1 && permission.id <= 49} // Admin role always has all predefined permissions
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </div>
                    ))}
                  </Card.Body>
                </Card>
              ) : (
                <Alert variant="info">
                  Please select a role from the list to manage its permissions.
                </Alert>
              )}
            </Col>
          </Row>
        </Tab>
        
        <Tab eventKey="new-role" title="Create New Role">
          <Card>
            <Card.Header>Create New Role</Card.Header>
            <Card.Body>
              {error && <Alert variant="danger">{error}</Alert>}
              {success && <Alert variant="success">{success}</Alert>}
              
              <Form onSubmit={handleCreateRole}>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Role Name (Internal)</Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="e.g., supervisor"
                        value={newRole.name}
                        onChange={(e) => setNewRole({...newRole, name: e.target.value})}
                        required
                      />
                      <Form.Text className="text-muted">
                        Internal name used in the system (lowercase, no spaces)
                      </Form.Text>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Display Name</Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="e.g., Supervisor"
                        value={newRole.displayName}
                        onChange={(e) => setNewRole({...newRole, displayName: e.target.value})}
                        required
                      />
                      <Form.Text className="text-muted">
                        Name displayed to users
                      </Form.Text>
                    </Form.Group>
                  </Col>
                </Row>
                
                <Form.Group className="mb-3">
                  <Form.Label>Description</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    placeholder="Role description"
                    value={newRole.description}
                    onChange={(e) => setNewRole({...newRole, description: e.target.value})}
                  />
                </Form.Group>
                
                <h6 className="mb-3 mt-4">Select Permissions</h6>
                
                {Object.entries(groupedPermissions).map(([resource, permissions]) => (
                  <div key={resource} className="mb-4">
                    <h6 className="border-bottom pb-2">{resource.charAt(0).toUpperCase() + resource.slice(1).replace('_', ' ')} Permissions</h6>
                    <Table striped bordered hover size="sm">
                      <thead>
                        <tr>
                          <th>Permission</th>
                          <th>Description</th>
                          <th style={{ width: '100px' }}>Enabled</th>
                        </tr>
                      </thead>
                      <tbody>
                        {permissions.map(permission => (
                          <tr key={permission.id}>
                            <td>{permission.type.charAt(0).toUpperCase() + permission.type.slice(1)}</td>
                            <td>{permission.description}</td>
                            <td className="text-center">
                              <Form.Check
                                type="switch"
                                id={`new-permission-${permission.id}`}
                                checked={newRole.permissions?.includes(permission.id) || false}
                                onChange={() => handleNewRolePermissionToggle(permission.id)}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                ))}
                
                <div className="d-flex justify-content-end mt-4">
                  <Button 
                    variant="secondary" 
                    className="me-2"
                    onClick={() => {
                      setNewRole({
                        name: '',
                        displayName: '',
                        description: '',
                        permissions: []
                      });
                      setError(null);
                      setSuccess(null);
                    }}
                    disabled={saving}
                  >
                    Reset
                  </Button>
                  <Button 
                    variant="primary" 
                    type="submit"
                    disabled={saving}
                  >
                    <FaPlus className="me-1" />
                    {saving ? 'Creating...' : 'Create Role'}
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Tab>
      </Tabs>
    </Container>
  );
};

export default AdminRolePermissions;
