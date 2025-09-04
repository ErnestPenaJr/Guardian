import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Table, Badge, Button, Alert, Tabs, Tab, Spinner } from 'react-bootstrap';
import { useAuth } from '../hooks/useAuth';
import api from '../utils/api';
import { FaEye, FaEdit, FaPlus, FaClipboardList, FaBell, FaTasks, FaUser, FaPlay, FaCheck, FaUserCog, FaFilter } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import ConsistentCard from '../components/ui/ConsistentCard';
import Swal from 'sweetalert2';

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

const ProcessorDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<Request[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('requests');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Format status for display
  const formatStatus = (status: string) => {
    switch (status) {
      case 'P':
        return <Badge bg="warning">Pending</Badge>;
      case 'A':
        return <Badge bg="primary">Active</Badge>;
      case 'D':
        return <Badge bg="success">Complete</Badge>;
      case 'X':
        return <Badge bg="warning">Cancelled</Badge>;
      case 'I':
        return <Badge bg="info">In Progress</Badge>;
      case 'H':
        return <Badge bg="secondary">On Hold</Badge>;
      case 'R':
        return <Badge bg="danger">Rejected</Badge>;
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
          api.get('/requests/group'),
          api.get('/notices/group'),
          api.get('/tasks/group')
        ]);

        setRequests(requestsRes.data);
        setNotices(noticesRes.data);
        setTasks(tasksRes.data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load dashboard data. Please try again.');
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Filter requests by status
  const filteredRequests = statusFilter === 'all' 
    ? requests 
    : requests.filter(request => request.STATUS === statusFilter);

  // Handle request approval
  const handleApproveRequest = async (requestId: number) => {
    try {
      await Swal.fire({
        title: 'Approve Request',
        text: 'Are you sure you want to approve this request?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, approve it',
        cancelButtonText: 'Cancel'
      }).then(async (result) => {
        if (result.isConfirmed) {
          await api.put(`/requests/${requestId}/approve`);
          
          // Update local state
          setRequests(requests.map(request => 
            request.REQUEST_ID === requestId 
              ? { ...request, STATUS: 'A' } 
              : request
          ));
          
          Swal.fire(
            'Approved!',
            'The request has been approved.',
            'success'
          );
        }
      });
    } catch (err) {
      console.error('Error approving request:', err);
      Swal.fire(
        'Error',
        'Failed to approve the request. Please try again.',
        'error'
      );
    }
  };

  // Handle task completion
  const handleCompleteTask = async (taskId: number) => {
    try {
      await Swal.fire({
        title: 'Complete Task',
        text: 'Are you sure you want to mark this task as completed?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, complete it',
        cancelButtonText: 'Cancel'
      }).then(async (result) => {
        if (result.isConfirmed) {
          await api.put(`/tasks/${taskId}/complete`);
          
          // Update local state
          setTasks(tasks.map(task => 
            task.TASK_ID === taskId 
              ? { ...task, STATUS: 'D' } 
              : task
          ));
          
          Swal.fire(
            'Completed!',
            'The task has been marked as completed.',
            'success'
          );
        }
      });
    } catch (err) {
      console.error('Error completing task:', err);
      Swal.fire(
        'Error',
        'Failed to complete the task. Please try again.',
        'error'
      );
    }
  };

  // Check if user is authorized to access this page
  if (user && !user.roles?.includes(5) && !user.roles?.includes(1)) {
    return (
      <Container className="mt-5">
        <Alert variant="danger">
          <h4>Access Denied</h4>
          <p>You do not have permission to access this page. This page is restricted to processors only.</p>
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
        Processor Dashboard
      </h2>

      {error && <Alert variant="danger">{error}</Alert>}

      <Row className="mb-4">
        <Col md={4}>
          <ConsistentCard
            title="Pending Requests"
            subtitle={`${requests.filter(r => r.STATUS === 'P').length} requests awaiting processing`}
            icon={<FaClipboardList />}
            variant="warning"
          >
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h2 className="mb-0 text-warning fw-bold">{requests.filter(r => r.STATUS === 'P').length}</h2>
                <small className="text-muted">Awaiting Processing</small>
              </div>
            </div>
          </ConsistentCard>
        </Col>
        
        <Col md={4}>
          <ConsistentCard
            title="Active Requests"
            subtitle={`${requests.filter(r => r.STATUS === 'A').length} requests currently in progress`}
            icon={<FaClipboardList />}
            variant="primary"
          >
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h2 className="mb-0 text-primary fw-bold">{requests.filter(r => r.STATUS === 'A').length}</h2>
                <small className="text-muted">In Progress</small>
              </div>
            </div>
          </ConsistentCard>
        </Col>
        
        <Col md={4}>
          <ConsistentCard
            title="Pending Tasks"
            subtitle={`${tasks.filter(t => t.STATUS === 'P').length} tasks requiring your attention`}
            icon={<FaTasks />}
            variant="info"
          >
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h2 className="mb-0 text-info fw-bold">{tasks.filter(t => t.STATUS === 'P').length}</h2>
                <small className="text-muted">Requiring Attention</small>
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
        <Tab eventKey="requests" title="Process Requests">
          <Card className="shadow-sm border-t-4 border-t-secondary rounded-3 border border-gray-200">
            <Card.Header className="bg-white">
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0">Group Requests</h5>
                <div className="d-flex align-items-center">
                  <Form.Select 
                    size="sm" 
                    className="me-2" 
                    style={{ width: '150px' }}
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="all">All Statuses</option>
                    <option value="P">Pending</option>
                    <option value="A">Active</option>
                    <option value="D">Complete</option>
                  </Form.Select>
                  <FaFilter className="text-muted" />
                </div>
              </div>
            </Card.Header>
            <Card.Body>
              {filteredRequests.length > 0 ? (
                <Table responsive hover>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Request Name</th>
                      <th>Requestor</th>
                      <th>Submitted Date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequests.map(request => (
                      <tr key={request.REQUEST_ID}>
                        <td>{request.REQUEST_ID}</td>
                        <td>{request.REQUEST_NAME}</td>
                        <td>{request.REQUESTOR_NAME || 'N/A'}</td>
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
                          <Button 
                            variant="outline-secondary" 
                            size="sm" 
                            className="me-1" 
                            title="Edit"
                            onClick={() => navigate(`/requests/${request.REQUEST_ID}/edit`)}
                          >
                            <FaEdit />
                          </Button>
                          {request.STATUS === 'P' && (
                            <Button 
                              variant="outline-success" 
                              size="sm" 
                              title="Approve"
                              onClick={() => handleApproveRequest(request.REQUEST_ID)}
                            >
                              <FaCheck />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <div className="text-center p-4">
                  <p className="text-muted mb-0">No requests found with the selected filter</p>
                </div>
              )}
            </Card.Body>
          </Card>
        </Tab>
        
        <Tab eventKey="tasks" title="Process Tasks">
          <Card className="shadow-sm border-t-4 border-t-secondary rounded-3 border border-gray-200">
            <Card.Header className="bg-white">
              <h5 className="mb-0">Group Tasks</h5>
            </Card.Header>
            <Card.Body>
              {tasks.length > 0 ? (
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
                          <Button 
                            variant="outline-primary" 
                            size="sm" 
                            className="me-1" 
                            title="View"
                            onClick={() => navigate(`/tasks/${task.TASK_ID}`)}
                          >
                            <FaEye />
                          </Button>
                          <Button 
                            variant="outline-secondary" 
                            size="sm" 
                            className="me-1" 
                            title="Edit"
                            onClick={() => navigate(`/tasks/${task.TASK_ID}/edit`)}
                          >
                            <FaEdit />
                          </Button>
                          {task.STATUS !== 'D' && (
                            <Button 
                              variant="outline-success" 
                              size="sm" 
                              title="Complete"
                              onClick={() => handleCompleteTask(task.TASK_ID)}
                            >
                              <FaCheck />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <div className="text-center p-4">
                  <p className="text-muted mb-0">No tasks found</p>
                </div>
              )}
            </Card.Body>
          </Card>
        </Tab>
        
        <Tab eventKey="notices" title="Notices">
          <Card className="shadow-sm border-t-4 border-t-secondary rounded-3 border border-gray-200">
            <Card.Header className="bg-white">
              <h5 className="mb-0">Group Notices</h5>
            </Card.Header>
            <Card.Body>
              {notices.length > 0 ? (
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
                            variant="outline-secondary" 
                            size="sm" 
                            title="Edit"
                            onClick={() => navigate(`/notices/${notice.NOTICE_ID}/edit`)}
                          >
                            <FaEdit />
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
      </Tabs>
    </Container>
  );
};

export default ProcessorDashboard;
