import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Table, Badge, Button, Alert, Tabs, Tab, Spinner } from 'react-bootstrap';
import { useAuth } from '../hooks/useAuth';
import api from '../utils/api';
import { FaEye, FaEdit, FaCheck, FaUserCog, FaClipboardList, FaBell, FaTasks, FaChartLine } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

// Define types for our data
interface Request {
  REQUEST_ID: number;
  REQUEST_NAME: string;
  SUBMITTED_DATE: string;
  STATUS: string;
  REQUESTOR_NAME?: string;
  ASSIGNED_NAME?: string;
}

interface Notice {
  NOTICE_ID: number;
  NOTICE_TITLE: string;
  CREATED_DATE: string;
  STATUS: string;
  CREATED_BY_NAME?: string;
}

interface Task {
  TASK_ID: number;
  DESCRIPTION: string;
  STATUS: string;
  ASSIGNED_USER_NAME?: string;
  CREATE_DATE: string;
}

interface User {
  USER_ID: number;
  FIRST_NAME: string;
  LAST_NAME: string;
  EMAIL: string;
  STATUS: string;
}

const ManagerDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<Request[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Format status for display
  const formatStatus = (status: string) => {
    switch (status) {
      case 'A':
        return <Badge bg="primary">Active</Badge>;
      case 'P':
        return <Badge bg="warning">Pending</Badge>;
      case 'C':
        return <Badge bg="success">Completed</Badge>;
      case 'D':
        return <Badge bg="danger">Deleted</Badge>;
      default:
        return <Badge bg="secondary">{status}</Badge>;
    }
  };

  // Load dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch data in parallel
        const [requestsRes, noticesRes, tasksRes, usersRes] = await Promise.all([
          api.get('/requests/group'),
          api.get('/notices/group'),
          api.get('/tasks/group'),
          api.get('/users/group')
        ]);

        setRequests(requestsRes.data);
        setNotices(noticesRes.data);
        setTasks(tasksRes.data);
        setTeamMembers(usersRes.data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load dashboard data. Please try again.');
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Check if user is authorized to access this page
  if (user && !user.roles?.includes(3) && !user.roles?.includes(1)) {
    return (
      <Container className="mt-5">
        <Alert variant="danger">
          <h4>Access Denied</h4>
          <p>You do not have permission to access this page. This page is restricted to managers only.</p>
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
        <FaUserCog className="me-2" />
        Manager Dashboard
      </h2>

      {error && <Alert variant="danger">{error}</Alert>}

      <Tabs
        activeKey={activeTab}
        onSelect={(k) => k && setActiveTab(k)}
        className="mb-4"
      >
        <Tab eventKey="overview" title="Overview">
          <Row>
            <Col md={4}>
              <Card className="mb-4 shadow-sm">
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <h5 className="card-title">Active Requests</h5>
                      <h2 className="mb-0">{requests.filter(r => r.STATUS === 'A').length}</h2>
                    </div>
                    <FaClipboardList size={40} className="text-primary" />
                  </div>
                </Card.Body>
                <Card.Footer className="bg-white">
                  <Button variant="outline-primary" size="sm" onClick={() => navigate('/requests')}>
                    View All Requests
                  </Button>
                </Card.Footer>
              </Card>
            </Col>
            
            <Col md={4}>
              <Card className="mb-4 shadow-sm">
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <h5 className="card-title">Active Notices</h5>
                      <h2 className="mb-0">{notices.filter(n => n.STATUS === 'A').length}</h2>
                    </div>
                    <FaBell size={40} className="text-warning" />
                  </div>
                </Card.Body>
                <Card.Footer className="bg-white">
                  <Button variant="outline-warning" size="sm" onClick={() => navigate('/notices')}>
                    View All Notices
                  </Button>
                </Card.Footer>
              </Card>
            </Col>
            
            <Col md={4}>
              <Card className="mb-4 shadow-sm">
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <h5 className="card-title">Pending Tasks</h5>
                      <h2 className="mb-0">{tasks.filter(t => t.STATUS === 'P').length}</h2>
                    </div>
                    <FaTasks size={40} className="text-success" />
                  </div>
                </Card.Body>
                <Card.Footer className="bg-white">
                  <Button variant="outline-success" size="sm" onClick={() => navigate('/tasks')}>
                    View All Tasks
                  </Button>
                </Card.Footer>
              </Card>
            </Col>
          </Row>

          <Row>
            <Col md={6}>
              <Card className="mb-4 shadow-sm">
                <Card.Header className="bg-white">
                  <h5 className="mb-0">Recent Requests</h5>
                </Card.Header>
                <Card.Body>
                  <Table responsive hover>
                    <thead>
                      <tr>
                        <th>Request</th>
                        <th>Submitted</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {requests.slice(0, 5).map(request => (
                        <tr key={request.REQUEST_ID}>
                          <td>{request.REQUEST_NAME}</td>
                          <td>{new Date(request.SUBMITTED_DATE).toLocaleDateString()}</td>
                          <td>{formatStatus(request.STATUS)}</td>
                          <td>
                            <Button variant="outline-primary" size="sm" className="me-1" title="View">
                              <FaEye />
                            </Button>
                            <Button variant="outline-secondary" size="sm" title="Edit">
                              <FaEdit />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            </Col>
            
            <Col md={6}>
              <Card className="mb-4 shadow-sm">
                <Card.Header className="bg-white">
                  <h5 className="mb-0">Team Members</h5>
                </Card.Header>
                <Card.Body>
                  <Table responsive hover>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamMembers.slice(0, 5).map(member => (
                        <tr key={member.USER_ID}>
                          <td>{`${member.FIRST_NAME} ${member.LAST_NAME}`}</td>
                          <td>{member.EMAIL}</td>
                          <td>{formatStatus(member.STATUS)}</td>
                          <td>
                            <Button variant="outline-primary" size="sm" className="me-1" title="View">
                              <FaEye />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Tab>
        
        <Tab eventKey="requests" title="Requests">
          <Card className="shadow-sm border-t-4 border-t-secondary rounded-3 border border-gray-200">
            <Card.Header className="bg-white">
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0">Group Requests</h5>
                <Button variant="primary" size="sm" onClick={() => navigate('/requests/new')}>
                  New Request
                </Button>
              </div>
            </Card.Header>
            <Card.Body>
              <Table responsive hover>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Request Name</th>
                    <th>Requestor</th>
                    <th>Assigned To</th>
                    <th>Submitted Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map(request => (
                    <tr key={request.REQUEST_ID}>
                      <td>{request.REQUEST_ID}</td>
                      <td>{request.REQUEST_NAME}</td>
                      <td>{request.REQUESTOR_NAME || 'N/A'}</td>
                      <td>{request.ASSIGNED_NAME || 'Unassigned'}</td>
                      <td>{new Date(request.SUBMITTED_DATE).toLocaleDateString()}</td>
                      <td>{formatStatus(request.STATUS)}</td>
                      <td>
                        <Button variant="outline-primary" size="sm" className="me-1" title="View">
                          <FaEye />
                        </Button>
                        <Button variant="outline-secondary" size="sm" className="me-1" title="Edit">
                          <FaEdit />
                        </Button>
                        <Button variant="outline-success" size="sm" title="Approve">
                          <FaCheck />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Tab>
        
        <Tab eventKey="notices" title="Notices">
          <Card className="shadow-sm border-t-4 border-t-secondary rounded-3 border border-gray-200">
            <Card.Header className="bg-white">
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0">Group Notices</h5>
                <Button variant="primary" size="sm" onClick={() => navigate('/notices/new')}>
                  New Notice
                </Button>
              </div>
            </Card.Header>
            <Card.Body>
              <Table responsive hover>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Title</th>
                    <th>Created By</th>
                    <th>Created Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {notices.map(notice => (
                    <tr key={notice.NOTICE_ID}>
                      <td>{notice.NOTICE_ID}</td>
                      <td>{notice.NOTICE_TITLE}</td>
                      <td>{notice.CREATED_BY_NAME || 'N/A'}</td>
                      <td>{new Date(notice.CREATED_DATE).toLocaleDateString()}</td>
                      <td>{formatStatus(notice.STATUS)}</td>
                      <td>
                        <Button variant="outline-primary" size="sm" className="me-1" title="View">
                          <FaEye />
                        </Button>
                        <Button variant="outline-secondary" size="sm" title="Edit">
                          <FaEdit />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Tab>
        
        <Tab eventKey="tasks" title="Tasks">
          <Card className="shadow-sm border-t-4 border-t-secondary rounded-3 border border-gray-200">
            <Card.Header className="bg-white">
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0">Group Tasks</h5>
                <Button variant="primary" size="sm" onClick={() => navigate('/tasks/new')}>
                  New Task
                </Button>
              </div>
            </Card.Header>
            <Card.Body>
              <Table responsive hover>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Description</th>
                    <th>Assigned To</th>
                    <th>Created Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map(task => (
                    <tr key={task.TASK_ID}>
                      <td>{task.TASK_ID}</td>
                      <td>{task.DESCRIPTION}</td>
                      <td>{task.ASSIGNED_USER_NAME || 'Unassigned'}</td>
                      <td>{new Date(task.CREATE_DATE).toLocaleDateString()}</td>
                      <td>{formatStatus(task.STATUS)}</td>
                      <td>
                        <Button variant="outline-primary" size="sm" className="me-1" title="View">
                          <FaEye />
                        </Button>
                        <Button variant="outline-secondary" size="sm" className="me-1" title="Edit">
                          <FaEdit />
                        </Button>
                        <Button variant="outline-success" size="sm" title="Complete">
                          <FaCheck />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Tab>
        
        <Tab eventKey="reports" title="Reports">
          <Card className="shadow-sm border-t-4 border-t-secondary rounded-3 border border-gray-200">
            <Card.Header className="bg-white">
              <h5 className="mb-0">Group Reports</h5>
            </Card.Header>
            <Card.Body>
              <div className="d-flex justify-content-center align-items-center p-5">
                <div className="text-center">
                  <FaChartLine size={50} className="text-muted mb-3" />
                  <h4>Reports Coming Soon</h4>
                  <p className="text-muted">
                    Workflow reporting features are currently under development.
                  </p>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Tab>
      </Tabs>
    </Container>
  );
};

export default ManagerDashboard;
