import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Table, Badge, Button, Alert, Tabs, Tab, Spinner, Form } from 'react-bootstrap';
import { useAuth } from '../hooks/useAuth';
import api from '../utils/api';
import { FaEye, FaEdit, FaPlus, FaClipboardList, FaBell, FaTasks, FaUser, FaReply } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import ConsistentCard from '../components/ui/ConsistentCard';

// Define types for our data
interface Request {
  REQUEST_ID: number;
  REQUEST_NAME: string;
  SUBMITTED_DATE: string;
  STATUS: string;
}

interface Notice {
  NOTICE_ID: number;
  NOTICE_TITLE: string;
  CREATED_DATE: string;
  STATUS: string;
}

interface Task {
  TASK_ID: number;
  DESCRIPTION: string;
  STATUS: string;
  CREATE_DATE: string;
}

const GeneralUserDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [myRequests, setMyRequests] = useState<Request[]>([]);
  const [myNotices, setMyNotices] = useState<Notice[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('requests');

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
        const [requestsRes, noticesRes, tasksRes] = await Promise.all([
          api.get('/requests/my'),
          api.get('/notices/my'),
          api.get('/tasks/my')
        ]);

        setMyRequests(requestsRes.data);
        setMyNotices(noticesRes.data);
        setMyTasks(tasksRes.data);
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
  if (user && !user.roles?.includes(2) && !user.roles?.includes(1)) {
    return (
      <Container className="mt-5">
        <Alert variant="danger">
          <h4>Access Denied</h4>
          <p>You do not have permission to access this page. This page is restricted to general users only.</p>
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
        <FaUser className="me-2" />
        My Dashboard
      </h2>

      {error && <Alert variant="danger">{error}</Alert>}

      <Row className="mb-4">
        <Col md={4}>
          <ConsistentCard
            title="My Requests"
            subtitle={`Manage and track your ${myRequests.length} requests efficiently`}
            icon={<FaClipboardList />}
            variant="primary"
            headerControls={
              <Button variant="primary" size="sm" onClick={() => navigate('/requests/new')}>
                <FaPlus className="me-1" /> New Request
              </Button>
            }
          >
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h2 className="mb-0 text-primary fw-bold">{myRequests.length}</h2>
                <small className="text-muted">Total Requests</small>
              </div>
            </div>
          </ConsistentCard>
        </Col>
        
        <Col md={4}>
          <ConsistentCard
            title="My Notices"
            subtitle={`Stay updated with ${myNotices.length} important notices`}
            icon={<FaBell />}
            variant="warning"
            headerControls={
              <Button variant="outline-secondary" size="sm">
                <FaEye className="me-1" /> View All
              </Button>
            }
          >
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h2 className="mb-0 text-warning fw-bold">{myNotices.length}</h2>
                <small className="text-muted">Active Notices</small>
              </div>
            </div>
          </ConsistentCard>
        </Col>
        
        <Col md={4}>
          <ConsistentCard
            title="My Tasks"
            subtitle={`Complete your ${myTasks.length} pending tasks efficiently`}
            icon={<FaTasks />}
            variant="success"
            headerControls={
              <Button variant="outline-secondary" size="sm">
                <FaEye className="me-1" /> View All
              </Button>
            }
          >
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h2 className="mb-0 text-success fw-bold">{myTasks.length}</h2>
                <small className="text-muted">Pending Tasks</small>
              </div>
            </div>
          </ConsistentCard>
        </Col>
      </Row>

      <Tabs
        activeKey={activeTab}
        onSelect={(k) => k && setActiveTab(k)}
        className="mb-4"
      >
        <Tab eventKey="requests" title="My Requests">
          <Card className="shadow-sm border-t-4 border-t-secondary rounded-3 border border-gray-200">
            <Card.Header className="bg-white">
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0">My Requests</h5>
                <Button variant="primary" size="sm" onClick={() => navigate('/requests/new')}>
                  <FaPlus className="me-1" /> New Request
                </Button>
              </div>
            </Card.Header>
            <Card.Body>
              {myRequests.length > 0 ? (
                <Table responsive hover>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Request Name</th>
                      <th>Submitted Date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myRequests.map(request => (
                      <tr key={request.REQUEST_ID}>
                        <td>{request.REQUEST_ID}</td>
                        <td>{request.REQUEST_NAME}</td>
                        <td>{new Date(request.SUBMITTED_DATE).toLocaleDateString()}</td>
                        <td>{formatStatus(request.STATUS)}</td>
                        <td>
                          <Button 
                            variant="outline-primary" 
                            size="sm" 
                            className="me-1" 
                            title="View"
                            onClick={() => navigate(`/requests/${request.REQUEST_ID}`)}
                          >
                            <FaEye />
                          </Button>
                          {request.STATUS === 'P' && (
                            <Button 
                              variant="outline-secondary" 
                              size="sm" 
                              title="Edit"
                              onClick={() => navigate(`/requests/${request.REQUEST_ID}/edit`)}
                            >
                              <FaEdit />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <div className="text-center p-4">
                  <p className="text-muted mb-0">No requests found</p>
                  <Button variant="primary" className="mt-3" onClick={() => navigate('/requests/new')}>
                    <FaPlus className="me-1" /> Create Your First Request
                  </Button>
                </div>
              )}
            </Card.Body>
          </Card>
        </Tab>
        
        <Tab eventKey="notices" title="My Notices">
          <Card className="shadow-sm border-t-4 border-t-secondary rounded-3 border border-gray-200">
            <Card.Header className="bg-white">
              <h5 className="mb-0">My Notices</h5>
            </Card.Header>
            <Card.Body>
              {myNotices.length > 0 ? (
                <Table responsive hover>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Title</th>
                      <th>Created Date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myNotices.map(notice => (
                      <tr key={notice.NOTICE_ID}>
                        <td>{notice.NOTICE_ID}</td>
                        <td>{notice.NOTICE_TITLE}</td>
                        <td>{new Date(notice.CREATED_DATE).toLocaleDateString()}</td>
                        <td>{formatStatus(notice.STATUS)}</td>
                        <td>
                          <Button 
                            variant="outline-primary" 
                            size="sm" 
                            className="me-1" 
                            title="View"
                            onClick={() => navigate(`/notices/${notice.NOTICE_ID}`)}
                          >
                            <FaEye />
                          </Button>
                          <Button 
                            variant="outline-warning" 
                            size="sm" 
                            title="Respond"
                            onClick={() => navigate(`/notices/${notice.NOTICE_ID}/respond`)}
                          >
                            <FaReply />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <div className="text-center p-4">
                  <p className="text-muted mb-0">No notices found</p>
                </div>
              )}
            </Card.Body>
          </Card>
        </Tab>
        
        <Tab eventKey="tasks" title="My Tasks">
          <Card className="shadow-sm border-t-4 border-t-secondary rounded-3 border border-gray-200">
            <Card.Header className="bg-white">
              <h5 className="mb-0">My Tasks</h5>
            </Card.Header>
            <Card.Body>
              {myTasks.length > 0 ? (
                <Table responsive hover>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Description</th>
                      <th>Created Date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myTasks.map(task => (
                      <tr key={task.TASK_ID}>
                        <td>{task.TASK_ID}</td>
                        <td>{task.DESCRIPTION}</td>
                        <td>{new Date(task.CREATE_DATE).toLocaleDateString()}</td>
                        <td>{formatStatus(task.STATUS)}</td>
                        <td>
                          <Button 
                            variant="outline-primary" 
                            size="sm" 
                            className="me-1" 
                            title="View"
                            onClick={() => navigate(`/tasks/${task.TASK_ID}`)}
                          >
                            <FaEye />
                          </Button>
                          {task.STATUS !== 'C' && (
                            <Button 
                              variant="outline-secondary" 
                              size="sm" 
                              title="Update"
                              onClick={() => navigate(`/tasks/${task.TASK_ID}/edit`)}
                            >
                              <FaEdit />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <div className="text-center p-4">
                  <p className="text-muted mb-0">No tasks assigned</p>
                </div>
              )}
            </Card.Body>
          </Card>
        </Tab>
      </Tabs>
    </Container>
  );
};

export default GeneralUserDashboard;
