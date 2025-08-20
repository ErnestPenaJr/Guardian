import React, { useState, useEffect } from 'react';
import { Card, Button, Form, Modal, Alert, Badge, Table, Dropdown, ProgressBar } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { 
  Users, 
  Plus, 
  Edit3, 
  Trash2, 
  UserPlus, 
  UserMinus, 
  Search, 
  Filter,
  MoreHorizontal,
  Eye,
  EyeOff,
  Star,
  RefreshCw,
  Settings,
  Copy,
  Archive,
  Shield,
  Crown,
  User,
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface ContactGroup {
  CONTACT_GROUP_ID: number;
  GROUP_NAME: string;
  GROUP_DESCRIPTION: string | null;
  GROUP_TYPE: string;
  COMPANY_ID: number;
  CREATED_BY_USER_ID: number;
  GROUP_STATUS: string;
  IS_PUBLIC: boolean;
  IS_SYSTEM_GROUP: boolean;
  AUTO_UPDATE: boolean;
  AUTO_UPDATE_CRITERIA: string | null;
  MEMBER_COUNT: number;
  LAST_USED_DATE: string | null;
  USAGE_COUNT: number;
  ACCESS_LEVEL: string;
  GROUP_COLOR: string | null;
  GROUP_ICON: string | null;
  SORT_ORDER: number;
  CREATE_DATE: string;
  CREATOR?: {
    FIRST_NAME: string;
    LAST_NAME: string;
    EMAIL: string;
  };
  _members?: GroupMember[];
}

interface GroupMember {
  GROUP_MEMBER_ID: number;
  CONTACT_GROUP_ID: number;
  USER_ID: number;
  MEMBER_TYPE: string;
  MEMBER_STATUS: string;
  ADDED_BY_USER_ID: number;
  ADDED_DATE: string;
  NOTIFICATION_PREFERENCE: string;
  IS_AUTO_ADDED: boolean;
  USER?: {
    FIRST_NAME: string;
    LAST_NAME: string;
    EMAIL: string;
  };
}

interface ContactGroupsManagerProps {
  show: boolean;
  onHide: () => void;
}

const GROUP_TYPES = [
  { value: 'CUSTOM', label: 'Custom Group', icon: <Users size={16} />, color: 'primary' },
  { value: 'DEPARTMENT', label: 'Department', icon: <Shield size={16} />, color: 'info' },
  { value: 'ROLE', label: 'Role-Based', icon: <Crown size={16} />, color: 'warning' },
  { value: 'PROJECT', label: 'Project Team', icon: <Users size={16} />, color: 'success' },
  { value: 'LOCATION', label: 'Location-Based', icon: <Users size={16} />, color: 'secondary' },
  { value: 'EMERGENCY', label: 'Emergency', icon: <AlertTriangle size={16} />, color: 'danger' },
  { value: 'TEAM', label: 'Team', icon: <Users size={16} />, color: 'primary' },
  { value: 'SKILL', label: 'Skill-Based', icon: <Star size={16} />, color: 'info' },
  { value: 'SHIFT', label: 'Shift-Based', icon: <Clock size={16} />, color: 'warning' }
];

const ACCESS_LEVELS = [
  { value: 'ADMIN_ONLY', label: 'Admin Only', description: 'Only administrators can use this group' },
  { value: 'MANAGER', label: 'Managers', description: 'Managers and above can use this group' },
  { value: 'PUBLIC', label: 'Public', description: 'All company users can see and use this group' },
  { value: 'CREATOR_ONLY', label: 'Creator Only', description: 'Only the creator can manage this group' }
];

const MEMBER_TYPES = [
  { value: 'MEMBER', label: 'Member', icon: <User size={14} />, color: 'primary' },
  { value: 'MANAGER', label: 'Manager', icon: <Shield size={14} />, color: 'warning' },
  { value: 'ADMIN', label: 'Admin', icon: <Crown size={14} />, color: 'danger' },
  { value: 'VIEWER', label: 'Viewer', icon: <Eye size={14} />, color: 'info' }
];

const ContactGroupsManager: React.FC<ContactGroupsManagerProps> = ({ show, onHide }) => {
  const { user } = useAuth();
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('ACTIVE');

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showMembersModal, setShowMembersModal] = useState<boolean>(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState<boolean>(false);
  const [selectedGroup, setSelectedGroup] = useState<ContactGroup | null>(null);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);

  // Form states
  const [formData, setFormData] = useState({
    groupName: '',
    groupDescription: '',
    groupType: 'CUSTOM',
    isPublic: false,
    autoUpdate: false,
    autoUpdateCriteria: '',
    accessLevel: 'ADMIN_ONLY',
    groupColor: '#007bff',
    groupIcon: 'users'
  });
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Load contact groups
  useEffect(() => {
    if (show) {
      loadContactGroups();
    }
  }, [show]);

  const loadContactGroups = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/contact-groups', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load contact groups');
      }

      const data = await response.json();
      setGroups(data);

    } catch (err: any) {
      console.error('Error loading contact groups:', err);
      setError(err.message || 'Failed to load contact groups');
      toast.error('Failed to load contact groups');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableUsers = async () => {
    try {
      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAvailableUsers(data);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.groupName.trim()) {
      toast.error('Please enter a group name');
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch('/api/contact-groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          groupName: formData.groupName.trim(),
          groupDescription: formData.groupDescription.trim() || null,
          groupType: formData.groupType,
          isPublic: formData.isPublic,
          autoUpdate: formData.autoUpdate,
          autoUpdateCriteria: formData.autoUpdateCriteria || null,
          accessLevel: formData.accessLevel,
          groupColor: formData.groupColor,
          groupIcon: formData.groupIcon
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create contact group');
      }

      toast.success('Contact group created successfully');
      setShowCreateModal(false);
      resetForm();
      loadContactGroups();

    } catch (err: any) {
      console.error('Error creating contact group:', err);
      toast.error(err.message || 'Failed to create contact group');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup) return;

    try {
      setSubmitting(true);

      const response = await fetch(`/api/contact-groups/${selectedGroup.CONTACT_GROUP_ID}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          groupName: formData.groupName.trim(),
          groupDescription: formData.groupDescription.trim() || null,
          groupType: formData.groupType,
          isPublic: formData.isPublic,
          autoUpdate: formData.autoUpdate,
          autoUpdateCriteria: formData.autoUpdateCriteria || null,
          accessLevel: formData.accessLevel,
          groupColor: formData.groupColor,
          groupIcon: formData.groupIcon
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update contact group');
      }

      toast.success('Contact group updated successfully');
      setShowEditModal(false);
      setSelectedGroup(null);
      resetForm();
      loadContactGroups();

    } catch (err: any) {
      console.error('Error updating contact group:', err);
      toast.error(err.message || 'Failed to update contact group');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteGroup = async (groupId: number) => {
    if (!confirm('Are you sure you want to delete this contact group? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/contact-groups/${groupId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete contact group');
      }

      toast.success('Contact group deleted successfully');
      loadContactGroups();

    } catch (err: any) {
      console.error('Error deleting contact group:', err);
      toast.error(err.message || 'Failed to delete contact group');
    }
  };

  const handleAddMember = async (userId: number, memberType: string = 'MEMBER') => {
    if (!selectedGroup) return;

    try {
      const response = await fetch(`/api/contact-groups/${selectedGroup.CONTACT_GROUP_ID}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          userId,
          memberType,
          notificationPreference: 'DEFAULT'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add member');
      }

      toast.success('Member added successfully');
      setShowAddMemberModal(false);
      loadGroupMembers(selectedGroup.CONTACT_GROUP_ID);

    } catch (err: any) {
      console.error('Error adding member:', err);
      toast.error(err.message || 'Failed to add member');
    }
  };

  const loadGroupMembers = async (groupId: number) => {
    try {
      const response = await fetch(`/api/contact-groups/${groupId}/members`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const members = await response.json();
        setGroups(prev => prev.map(group => 
          group.CONTACT_GROUP_ID === groupId 
            ? { ...group, _members: members }
            : group
        ));
      }
    } catch (error) {
      console.error('Error loading group members:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      groupName: '',
      groupDescription: '',
      groupType: 'CUSTOM',
      isPublic: false,
      autoUpdate: false,
      autoUpdateCriteria: '',
      accessLevel: 'ADMIN_ONLY',
      groupColor: '#007bff',
      groupIcon: 'users'
    });
  };

  const openEditModal = (group: ContactGroup) => {
    setSelectedGroup(group);
    setFormData({
      groupName: group.GROUP_NAME,
      groupDescription: group.GROUP_DESCRIPTION || '',
      groupType: group.GROUP_TYPE,
      isPublic: group.IS_PUBLIC,
      autoUpdate: group.AUTO_UPDATE,
      autoUpdateCriteria: group.AUTO_UPDATE_CRITERIA || '',
      accessLevel: group.ACCESS_LEVEL,
      groupColor: group.GROUP_COLOR || '#007bff',
      groupIcon: group.GROUP_ICON || 'users'
    });
    setShowEditModal(true);
  };

  const openMembersModal = (group: ContactGroup) => {
    setSelectedGroup(group);
    loadGroupMembers(group.CONTACT_GROUP_ID);
    setShowMembersModal(true);
  };

  const openAddMemberModal = () => {
    loadAvailableUsers();
    setShowAddMemberModal(true);
  };

  const getGroupTypeInfo = (type: string) => {
    return GROUP_TYPES.find(t => t.value === type) || GROUP_TYPES[0];
  };

  const getMemberTypeInfo = (type: string) => {
    return MEMBER_TYPES.find(t => t.value === type) || MEMBER_TYPES[0];
  };

  const filteredGroups = groups.filter(group => {
    const matchesSearch = group.GROUP_NAME.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (group.GROUP_DESCRIPTION || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = !filterType || group.GROUP_TYPE === filterType;
    const matchesStatus = !filterStatus || group.GROUP_STATUS === filterStatus;
    
    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <Modal show={show} onHide={onHide} size="xl" centered>
      <Modal.Header closeButton>
        <Modal.Title>
          <Users size={20} className="me-2" />
          Contact Groups Manager
        </Modal.Title>
      </Modal.Header>

      <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        {/* Controls */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="d-flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowCreateModal(true)}
              className="d-flex align-items-center"
            >
              <Plus size={14} className="me-1" />
              New Group
            </Button>
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={loadContactGroups}
              disabled={loading}
              className="d-flex align-items-center"
            >
              <RefreshCw size={14} className="me-1" />
              Refresh
            </Button>
          </div>

          <div className="d-flex gap-2">
            {/* Search */}
            <div className="position-relative">
              <Search size={16} className="position-absolute" style={{ left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#6c757d' }} />
              <Form.Control
                type="text"
                size="sm"
                placeholder="Search groups..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '32px', width: '200px' }}
              />
            </div>

            {/* Type Filter */}
            <Form.Select
              size="sm"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{ width: '150px' }}
            >
              <option value="">All Types</option>
              {GROUP_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </Form.Select>

            {/* Status Filter */}
            <Form.Select
              size="sm"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ width: '120px' }}
            >
              <option value="">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="ARCHIVED">Archived</option>
            </Form.Select>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="danger" className="mb-3">
            <AlertTriangle size={16} className="me-2" />
            {error}
          </Alert>
        )}

        {/* Groups Table */}
        {loading ? (
          <div className="text-center py-4">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-2 text-muted">Loading contact groups...</p>
          </div>
        ) : filteredGroups.length === 0 ? (
          <Card className="text-center text-muted py-4">
            <Card.Body>
              <Users size={48} className="mb-3" />
              <p className="mb-0">
                {searchTerm || filterType || (filterStatus && filterStatus !== 'ACTIVE')
                  ? 'No contact groups match your current filters.'
                  : 'No contact groups found. Create your first group to get started!'
                }
              </p>
            </Card.Body>
          </Card>
        ) : (
          <Table responsive hover>
            <thead>
              <tr>
                <th>Group Name</th>
                <th>Type</th>
                <th>Members</th>
                <th>Access</th>
                <th>Usage</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredGroups.map((group) => {
                const typeInfo = getGroupTypeInfo(group.GROUP_TYPE);
                return (
                  <tr key={group.CONTACT_GROUP_ID}>
                    <td>
                      <div className="d-flex align-items-center">
                        <div 
                          className="me-2 rounded-circle d-flex align-items-center justify-content-center"
                          style={{ 
                            width: '24px', 
                            height: '24px', 
                            backgroundColor: group.GROUP_COLOR || '#007bff',
                            color: 'white',
                            fontSize: '10px'
                          }}
                        >
                          {typeInfo.icon}
                        </div>
                        <div>
                          <div className="fw-medium">{group.GROUP_NAME}</div>
                          {group.GROUP_DESCRIPTION && (
                            <small className="text-muted">{group.GROUP_DESCRIPTION}</small>
                          )}
                          {group.IS_SYSTEM_GROUP && (
                            <Badge bg="info" size="sm" className="ms-1">System</Badge>
                          )}
                          {group.AUTO_UPDATE && (
                            <Badge bg="success" size="sm" className="ms-1">Auto</Badge>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <Badge bg={typeInfo.color}>
                        {typeInfo.icon}
                        <span className="ms-1">{typeInfo.label}</span>
                      </Badge>
                    </td>
                    <td>
                      <Button
                        variant="link"
                        size="sm"
                        className="p-0"
                        onClick={() => openMembersModal(group)}
                      >
                        {group.MEMBER_COUNT} members
                      </Button>
                    </td>
                    <td>
                      <Badge bg={group.ACCESS_LEVEL === 'PUBLIC' ? 'success' : 'warning'}>
                        {group.ACCESS_LEVEL === 'PUBLIC' ? <Eye size={12} /> : <EyeOff size={12} />}
                        <span className="ms-1">
                          {ACCESS_LEVELS.find(a => a.value === group.ACCESS_LEVEL)?.label || group.ACCESS_LEVEL}
                        </span>
                      </Badge>
                    </td>
                    <td>
                      <div className="text-center">
                        <div className="fw-medium">{group.USAGE_COUNT}</div>
                        <small className="text-muted">
                          {group.LAST_USED_DATE 
                            ? new Date(group.LAST_USED_DATE).toLocaleDateString()
                            : 'Never used'
                          }
                        </small>
                      </div>
                    </td>
                    <td>
                      <Badge bg={
                        group.GROUP_STATUS === 'ACTIVE' ? 'success' : 
                        group.GROUP_STATUS === 'INACTIVE' ? 'warning' : 'secondary'
                      }>
                        {group.GROUP_STATUS}
                      </Badge>
                    </td>
                    <td>
                      <Dropdown>
                        <Dropdown.Toggle variant="link" size="sm" className="text-muted">
                          <MoreHorizontal size={16} />
                        </Dropdown.Toggle>
                        <Dropdown.Menu>
                          <Dropdown.Item onClick={() => openMembersModal(group)}>
                            <Users size={14} className="me-2" />
                            View Members
                          </Dropdown.Item>
                          <Dropdown.Item onClick={() => openEditModal(group)}>
                            <Edit3 size={14} className="me-2" />
                            Edit Group
                          </Dropdown.Item>
                          <Dropdown.Divider />
                          <Dropdown.Item 
                            onClick={() => handleDeleteGroup(group.CONTACT_GROUP_ID)}
                            className="text-danger"
                          >
                            <Trash2 size={14} className="me-2" />
                            Delete
                          </Dropdown.Item>
                        </Dropdown.Menu>
                      </Dropdown>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>

      {/* Create Group Modal */}
      <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Create Contact Group</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleCreateGroup}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Group Name <span className="text-danger">*</span></Form.Label>
              <Form.Control
                type="text"
                value={formData.groupName}
                onChange={(e) => setFormData({ ...formData, groupName: e.target.value })}
                placeholder="Enter group name..."
                required
                disabled={submitting}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={formData.groupDescription}
                onChange={(e) => setFormData({ ...formData, groupDescription: e.target.value })}
                placeholder="Optional description..."
                disabled={submitting}
              />
            </Form.Group>

            <div className="row mb-3">
              <div className="col-md-6">
                <Form.Group>
                  <Form.Label>Group Type</Form.Label>
                  <Form.Select
                    value={formData.groupType}
                    onChange={(e) => setFormData({ ...formData, groupType: e.target.value })}
                    disabled={submitting}
                  >
                    {GROUP_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </div>
              <div className="col-md-6">
                <Form.Group>
                  <Form.Label>Access Level</Form.Label>
                  <Form.Select
                    value={formData.accessLevel}
                    onChange={(e) => setFormData({ ...formData, accessLevel: e.target.value })}
                    disabled={submitting}
                  >
                    {ACCESS_LEVELS.map(level => (
                      <option key={level.value} value={level.value}>{level.label}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </div>
            </div>

            <div className="row mb-3">
              <div className="col-md-6">
                <Form.Check
                  type="checkbox"
                  id="isPublic"
                  checked={formData.isPublic}
                  onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                  label="Public group"
                  disabled={submitting}
                />
              </div>
              <div className="col-md-6">
                <Form.Check
                  type="checkbox"
                  id="autoUpdate"
                  checked={formData.autoUpdate}
                  onChange={(e) => setFormData({ ...formData, autoUpdate: e.target.checked })}
                  label="Auto-update membership"
                  disabled={submitting}
                />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={submitting || !formData.groupName.trim()}>
              {submitting ? 'Creating...' : 'Create Group'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Edit Group Modal */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Edit Contact Group</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleEditGroup}>
          <Modal.Body>
            {/* Same form fields as create modal */}
            <Form.Group className="mb-3">
              <Form.Label>Group Name <span className="text-danger">*</span></Form.Label>
              <Form.Control
                type="text"
                value={formData.groupName}
                onChange={(e) => setFormData({ ...formData, groupName: e.target.value })}
                placeholder="Enter group name..."
                required
                disabled={submitting}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={formData.groupDescription}
                onChange={(e) => setFormData({ ...formData, groupDescription: e.target.value })}
                placeholder="Optional description..."
                disabled={submitting}
              />
            </Form.Group>

            <div className="row mb-3">
              <div className="col-md-6">
                <Form.Group>
                  <Form.Label>Access Level</Form.Label>
                  <Form.Select
                    value={formData.accessLevel}
                    onChange={(e) => setFormData({ ...formData, accessLevel: e.target.value })}
                    disabled={submitting}
                  >
                    {ACCESS_LEVELS.map(level => (
                      <option key={level.value} value={level.value}>{level.label}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </div>
              <div className="col-md-6">
                <Form.Check
                  type="checkbox"
                  id="isPublicEdit"
                  checked={formData.isPublic}
                  onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                  label="Public group"
                  disabled={submitting}
                />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowEditModal(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={submitting || !formData.groupName.trim()}>
              {submitting ? 'Updating...' : 'Update Group'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Members Modal */}
      <Modal show={showMembersModal} onHide={() => setShowMembersModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>
            Group Members - {selectedGroup?.GROUP_NAME}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h6 className="mb-0">
              {selectedGroup?._members?.length || 0} Members
            </h6>
            <Button
              variant="primary"
              size="sm"
              onClick={openAddMemberModal}
              className="d-flex align-items-center"
            >
              <UserPlus size={14} className="me-1" />
              Add Member
            </Button>
          </div>

          {selectedGroup?._members && selectedGroup._members.length > 0 ? (
            <Table responsive>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Added</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {selectedGroup._members.map((member) => {
                  const memberTypeInfo = getMemberTypeInfo(member.MEMBER_TYPE);
                  return (
                    <tr key={member.GROUP_MEMBER_ID}>
                      <td>
                        <div>
                          <div className="fw-medium">
                            {member.USER ? `${member.USER.FIRST_NAME} ${member.USER.LAST_NAME}` : 'Unknown'}
                          </div>
                          <small className="text-muted">{member.USER?.EMAIL}</small>
                        </div>
                      </td>
                      <td>
                        <Badge bg={memberTypeInfo.color}>
                          {memberTypeInfo.icon}
                          <span className="ms-1">{memberTypeInfo.label}</span>
                        </Badge>
                      </td>
                      <td>
                        <Badge bg={member.MEMBER_STATUS === 'ACTIVE' ? 'success' : 'warning'}>
                          {member.MEMBER_STATUS}
                        </Badge>
                      </td>
                      <td>
                        <small className="text-muted">
                          {new Date(member.ADDED_DATE).toLocaleDateString()}
                        </small>
                      </td>
                      <td>
                        <Button
                          variant="link"
                          size="sm"
                          className="text-danger p-0"
                          title="Remove member"
                        >
                          <UserMinus size={14} />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          ) : (
            <div className="text-center text-muted py-4">
              <Users size={48} className="mb-3" />
              <p className="mb-0">No members in this group yet.</p>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowMembersModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Add Member Modal */}
      <Modal show={showAddMemberModal} onHide={() => setShowAddMemberModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Add Group Member</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {availableUsers.length > 0 ? (
            <div>
              <Form.Group className="mb-3">
                <Form.Label>Select User</Form.Label>
                <Form.Select>
                  <option value="">Choose a user...</option>
                  {availableUsers.map(user => (
                    <option key={user.USER_ID} value={user.USER_ID}>
                      {user.FIRST_NAME} {user.LAST_NAME} ({user.EMAIL})
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Member Role</Form.Label>
                <Form.Select>
                  {MEMBER_TYPES.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </div>
          ) : (
            <div className="text-center text-muted py-4">
              <User size={48} className="mb-3" />
              <p className="mb-0">Loading available users...</p>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAddMemberModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" disabled={availableUsers.length === 0}>
            Add Member
          </Button>
        </Modal.Footer>
      </Modal>
    </Modal>
  );
};

export default ContactGroupsManager;