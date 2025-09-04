import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Alert, Table, Badge, Spinner } from 'react-bootstrap';
import { useAuth } from '../hooks/useAuth';
import api from '../utils/api';
import { FaClipboardList, FaBell, FaPlus, FaEye, FaExclamationTriangle } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

interface ExternalRequest {
  REQUEST_ID: number;
  REQUEST_NAME: string;
  SUBMITTED_DATE: string;
  STATUS: string;
}

interface ExternalNotice {
  NOTICE_ID: number;
  NOTICE_TITLE: string;
  CREATED_DATE: string;
  STATUS: string;
}

const ExternalUserDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<ExternalRequest[]>([]);
  const [notices, setNotices] = useState<ExternalNotice[]>([]);

  useEffect(() => {
    const fetchExternalData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch requests and notices in parallel
        const [requestsResponse, noticesResponse] = await Promise.all([
          api.get('/external/requests'),
          api.get('/external/notices')
        ]);

        setRequests(requestsResponse.data);
        setNotices(noticesResponse.data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching external user data:', err);
        setError('Failed to load your data. Please try again or contact support.');
        setLoading(false);
      }
    };

    fetchExternalData();
  }, []);

  // Get status badge variant
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'P':
        return <Badge bg="warning">Pending</Badge>;
      case 'A':
        return <Badge bg="success">Approved</Badge>;
      case 'R':
        return <Badge bg="danger">Rejected</Badge>;
      case 'D':
        return <Badge bg="success">Complete</Badge>;
      case 'X':
        return <Badge bg="warning">Cancelled</Badge>;
      default:
        return <Badge bg="secondary">{status}</Badge>;
    }
  };

  // Get notice status badge variant
  const getNoticeBadge = (status: string) => {
    switch (status) {
      case 'N':
        return <Badge bg="danger">New</Badge>;
      case 'R':
        return <Badge bg="warning">Response Required</Badge>;
      case 'D':
        return <Badge bg="success">Complete</Badge>;
      case 'X':
        return <Badge bg="warning">Cancelled</Badge>;
      default:
        return <Badge bg="secondary">{status}</Badge>;
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch (error) {
      return dateString;
    }
  };

  // Check if user is authorized to access this page
  if (user && !user.roles?.includes(6) && !user.roles?.includes(1)) {
    return (
      <Container className="mt-5">
        <Alert variant="danger">
          <h4>Access Denied</h4>
          <p>You do not have permission to access this page. This page is restricted to external users only.</p>
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
    <Container className="mt-4">
      <h2 className="mb-4">External User Dashboard</h2>

      {error && <Alert variant="danger">{error}</Alert>}

      <Card className="shadow-lg rounded-3 border border-gray-200 mb-4">
        <Card.Header className="bg-primary text-white">
          <h4 className="mb-0">Welcome, {user?.firstName || 'Guest'}</h4>
        </Card.Header>
        <Card.Body>
          <p>
            Welcome to the Guardian MVP External Portal. As an external user, you can:
          </p>
          <ul>
            <li>Submit new requests to the organization</li>
            <li>View the status of your existing requests</li>
            <li>Respond to notices that require your attention</li>
            <li>Upload documents and attachments as needed</li>
          </ul>
          <p>
            If you need assistance, please contact your organization administrator.
          </p>
          <div className="mt-3">
            <Button 
              variant="primary" 
              onClick={() => navigate('/external/request/new')}
              className="me-2"
            >
              <FaPlus className="me-2" />
              Submit New Request
            </Button>
          </div>
        </Card.Body>
      </Card>

      <Row>
        <Col md={6}>
          <Card className="shadow-lg rounded-3 border border-gray-200 mb-4">
            <Card.Header className="bg-white">
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0">
                  <FaClipboardList className="me-2" />
                  My Requests
                </h5>
                <Button 
                  variant="outline-primary" 
                  size="sm"
                  onClick={() => navigate('/external/requests')}
                >
                  View All
                </Button>
              </div>
            </Card.Header>
            <Card.Body>
              {requests.length === 0 ? (
                <Alert variant="info">
                  You have no requests. Click "Submit New Request" to get started.
                </Alert>
              ) : (
                <Table responsive hover>
                  <thead>
                    <tr>
                      <th>Request Name</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.slice(0, 5).map(request => (
                      <tr key={request.REQUEST_ID}>
                        <td>{request.REQUEST_NAME}</td>
                        <td>{formatDate(request.SUBMITTED_DATE)}</td>
                        <td>{getStatusBadge(request.STATUS)}</td>
                        <td>
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={() => navigate(`/external/requests/${request.REQUEST_ID}`)}
                          >
                            <FaEye />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col md={6}>
          <Card className="shadow-lg rounded-3 border border-gray-200 mb-4">
            <Card.Header className="bg-white">
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0">
                  <FaBell className="me-2" />
                  My Notices
                </h5>
                <Button 
                  variant="outline-primary" 
                  size="sm"
                  onClick={() => navigate('/external/notices')}
                >
                  View All
                </Button>
              </div>
            </Card.Header>
            <Card.Body>
              {notices.length === 0 ? (
                <Alert variant="info">
                  You have no notices at this time.
                </Alert>
              ) : (
                <Table responsive hover>
                  <thead>
                    <tr>
                      <th>Notice Title</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notices.slice(0, 5).map(notice => (
                      <tr key={notice.NOTICE_ID}>
                        <td>
                          {notice.STATUS === 'N' && (
                            <FaExclamationTriangle className="text-danger me-1" />
                          )}
                          {notice.NOTICE_TITLE}
                        </td>
                        <td>{formatDate(notice.CREATED_DATE)}</td>
                        <td>{getNoticeBadge(notice.STATUS)}</td>
                        <td>
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={() => navigate(`/external/notices/${notice.NOTICE_ID}`)}
                          >
                            <FaEye />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default ExternalUserDashboard;
