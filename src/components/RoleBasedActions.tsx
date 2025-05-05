import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { Card, ListGroup, Badge } from 'react-bootstrap';
import { 
  FaUserShield, 
  FaUserCog, 
  FaUserTie, 
  FaUser, 
  FaClipboardList, 
  FaBell, 
  FaTasks,
  FaFileAlt,
  FaChartLine
} from 'react-icons/fa';

interface ActionItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles: number[];
}

const RoleBasedActions: React.FC = () => {
  const { user } = useAuth();
  const userRoles = user?.roles || [];

  // Define role names for display
  const getRoleName = (roleId: number): string => {
    switch (roleId) {
      case 1: return 'Administrator';
      case 2: return 'User';
      case 3: return 'Manager';
      case 4: return 'Supervisor';
      default: return 'Unknown';
    }
  };

  // Get the highest role for the user (for display purposes)
  const getHighestRole = (roles: number[]): number => {
    if (roles.includes(1)) return 1;
    if (roles.includes(3)) return 3;
    if (roles.includes(4)) return 4;
    if (roles.includes(2)) return 2;
    return 0;
  };

  // Get the icon for the role
  const getRoleIcon = (roleId: number): React.ReactNode => {
    switch (roleId) {
      case 1: return <FaUserShield className="text-danger" />;
      case 2: return <FaUser className="text-primary" />;
      case 3: return <FaUserCog className="text-success" />;
      case 4: return <FaUserTie className="text-info" />;
      default: return <FaUser className="text-secondary" />;
    }
  };

  // Define actions available based on role
  const actions: ActionItem[] = [
    // Request actions
    { 
      label: 'View My Requests', 
      path: '/requests/my', 
      icon: <FaClipboardList className="text-primary" />, 
      roles: [1, 2, 3, 4] 
    },
    { 
      label: 'Create New Request', 
      path: '/requests/new', 
      icon: <FaClipboardList className="text-success" />, 
      roles: [1, 2, 3, 4] 
    },
    { 
      label: 'View All Group Requests', 
      path: '/requests/group', 
      icon: <FaClipboardList className="text-warning" />, 
      roles: [1, 3, 4] 
    },
    { 
      label: 'Approve Requests', 
      path: '/requests/approve', 
      icon: <FaClipboardList className="text-danger" />, 
      roles: [1, 3, 4] 
    },
    { 
      label: 'Assign Requests', 
      path: '/requests/assign', 
      icon: <FaClipboardList className="text-info" />, 
      roles: [1, 3] 
    },
    
    // Notice actions
    { 
      label: 'View My Notices', 
      path: '/notices/my', 
      icon: <FaBell className="text-primary" />, 
      roles: [1, 2, 3, 4] 
    },
    { 
      label: 'Create New Notice', 
      path: '/notices/new', 
      icon: <FaBell className="text-success" />, 
      roles: [1, 3, 4] 
    },
    { 
      label: 'View All Group Notices', 
      path: '/notices/group', 
      icon: <FaBell className="text-warning" />, 
      roles: [1, 3, 4] 
    },
    
    // Task actions
    { 
      label: 'View My Tasks', 
      path: '/tasks/my', 
      icon: <FaTasks className="text-primary" />, 
      roles: [1, 2, 3, 4] 
    },
    { 
      label: 'Create New Task', 
      path: '/tasks/new', 
      icon: <FaTasks className="text-success" />, 
      roles: [1, 2, 3, 4] 
    },
    { 
      label: 'View All Group Tasks', 
      path: '/tasks/group', 
      icon: <FaTasks className="text-warning" />, 
      roles: [1, 3, 4] 
    },
    { 
      label: 'Assign Tasks', 
      path: '/tasks/assign', 
      icon: <FaTasks className="text-info" />, 
      roles: [1, 3, 4] 
    },
    
    // Form actions
    { 
      label: 'View Forms', 
      path: '/forms', 
      icon: <FaFileAlt className="text-primary" />, 
      roles: [1, 2, 3, 4] 
    },
    { 
      label: 'Create/Edit Forms', 
      path: '/forms/manage', 
      icon: <FaFileAlt className="text-success" />, 
      roles: [1] 
    },
    
    // Report actions
    { 
      label: 'View My Reports', 
      path: '/reports/my', 
      icon: <FaChartLine className="text-primary" />, 
      roles: [1, 2, 3, 4] 
    },
    { 
      label: 'View Group Reports', 
      path: '/reports/group', 
      icon: <FaChartLine className="text-warning" />, 
      roles: [1, 3, 4] 
    },
    
    // Admin actions
    { 
      label: 'User Management', 
      path: '/admin/users', 
      icon: <FaUserShield className="text-danger" />, 
      roles: [1] 
    },
    { 
      label: 'Role Management', 
      path: '/admin/roles', 
      icon: <FaUserShield className="text-danger" />, 
      roles: [1] 
    },
    { 
      label: 'System Settings', 
      path: '/admin/settings', 
      icon: <FaUserShield className="text-danger" />, 
      roles: [1] 
    }
  ];

  // Filter actions based on user roles
  const filteredActions = actions.filter(action => 
    action.roles.some(role => userRoles.includes(role))
  );

  // Group actions by category
  const groupedActions = filteredActions.reduce((acc, action) => {
    const category = action.path.split('/')[1];
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(action);
    return acc;
  }, {} as Record<string, ActionItem[]>);

  const highestRoleId = getHighestRole(userRoles);

  return (
    <Card className="shadow-sm mb-4">
      <Card.Header className="bg-white">
        <div className="d-flex align-items-center">
          {getRoleIcon(highestRoleId)}
          <span className="ms-2 fw-bold">Your Role: {getRoleName(highestRoleId)}</span>
          {userRoles.length > 1 && (
            <Badge bg="secondary" className="ms-2">
              +{userRoles.length - 1} more
            </Badge>
          )}
        </div>
      </Card.Header>
      <Card.Body>
        <h6 className="mb-3">Available Actions</h6>
        
        {Object.entries(groupedActions).map(([category, items]) => (
          <div key={category} className="mb-3">
            <h6 className="text-muted text-capitalize">{category}</h6>
            <ListGroup variant="flush">
              {items.map((action, index) => (
                <ListGroup.Item 
                  key={index}
                  action
                  href={action.path}
                  className="d-flex align-items-center py-2"
                >
                  <span className="me-2">{action.icon}</span>
                  {action.label}
                </ListGroup.Item>
              ))}
            </ListGroup>
          </div>
        ))}
      </Card.Body>
      <Card.Footer className="bg-white text-center">
        <small className="text-muted">
          Need more permissions? Contact your administrator.
        </small>
      </Card.Footer>
    </Card>
  );
};

export default RoleBasedActions;
