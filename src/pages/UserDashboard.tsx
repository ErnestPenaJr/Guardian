import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Table, Badge, Button, Alert, Spinner } from 'react-bootstrap';
import { useAuth } from '../hooks/useAuth';
import api from '../utils/api';
import { FaEye, FaClipboardList, FaBell, FaTasks, FaUser } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import RoleBasedActions from '../components/RoleBasedActions';

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

const UserDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [myRequests, setMyRequests] = useState<Request[]>([]);
  const [myNotices, setMyNotices] = useState<Notice[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

      <Row>
        <Col md={4}>
          <RoleBasedActions />
        </Col>
        
        <Col md={8}>
          <Row>
            <Col md={4}>
              <Card className="mb-4 shadow-sm">
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <h5 className="card-title">My Requests</h5>
                      <h2 className="mb-0">{myRequests.length}</h2>
                    </div>
                    <FaClipboardList size={40} className="text-primary" />
                  </div>
                </Card.Body>
                <Card.Footer className="bg-white">
                  <Button variant="outline-primary" size="sm" onClick={() => navigate('/requests/my')}>
                    View My Requests
                  </Button>
                </Card.Footer>
              </Card>
            </Col>
            
            <Col md={4}>
              <Card className="mb-4 shadow-sm">
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <h5 className="card-title">My Notices</h5>
                      <h2 className="mb-0">{myNotices.length}</h2>
                    </div>
                    <FaBell size={40} className="text-warning" />
                  </div>
                </Card.Body>
                <Card.Footer className="bg-white">
                  <Button variant="outline-warning" size="sm" onClick={() => navigate('/notices/my')}>
                    View My Notices
                  </Button>
                </Card.Footer>
              </Card>
            </Col>
            
            <Col md={4}>
              <Card className="mb-4 shadow-sm">
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <h5 className="card-title">My Tasks</h5>
                      <h2 className="mb-0">{myTasks.length}</h2>
                    </div>
                    <FaTasks size={40} className="text-success" />
                  </div>
                </Card.Body>
                <Card.Footer className="bg-white">
                  <Button variant="outline-success" size="sm" onClick={() => navigate('/tasks/my')}>
                    View My Tasks
                  </Button>
                </Card.Footer>
              </Card>
            </Col>
          </Row>

          <Row>
            <Col md={12}>
              <Card className="mb-4 shadow-sm">
                <Card.Header className="bg-white">
                  <h5 className="mb-0">Recent Requests</h5>
                </Card.Header>
                <Card.Body>
                  {myRequests.length > 0 ? (
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
                        {myRequests.slice(0, 5).map(request => (
                          <tr key={request.REQUEST_ID}>
                            <td>{request.REQUEST_NAME}</td>
                            <td>{new Date(request.SUBMITTED_DATE).toLocaleDateString()}</td>
                            <td>{formatStatus(request.STATUS)}</td>
                            <td>
                              <Button 
                                variant="outline-primary" 
                                size="sm" 
                                onClick={() => navigate(`/requests/${request.REQUEST_ID}`)}
                              >
                                <FaEye />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  ) : (
                    <div className="text-center p-4">
                      <p className="text-muted mb-0">No requests found</p>
                    </div>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>

          <Row>
            <Col md={12}>
              <Card className="mb-4 shadow-sm">
                <Card.Header className="bg-white">
                  <h5 className="mb-0">My Tasks</h5>
                </Card.Header>
                <Card.Body>
                  {myTasks.length > 0 ? (
                    <Table responsive hover>
                      <thead>
                        <tr>
                          <th>Description</th>
                          <th>Created</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {myTasks.slice(0, 5).map(task => (
                          <tr key={task.TASK_ID}>
                            <td>{task.DESCRIPTION}</td>
                            <td>{new Date(task.CREATE_DATE).toLocaleDateString()}</td>
                            <td>{formatStatus(task.STATUS)}</td>
                            <td>
                              <Button 
                                variant="outline-primary" 
                                size="sm" 
                                onClick={() => navigate(`/tasks/${task.TASK_ID}`)}
                              >
                                <FaEye />
                              </Button>
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
            </Col>
          </Row>
        </Col>
      </Row>
    </Container>
  );
};

export default UserDashboard;
