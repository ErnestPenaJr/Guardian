import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, Container, Row, Col, Accordion, Badge, Button, Modal, Form, Alert } from 'react-bootstrap';
import EndpointTester from './EndpointTester';
import EndpointDetails from './EndpointDetails';
import './EndpointManager.css';

interface Endpoint {
  path: string;
  methods: string[];
  type: string;
  description?: string;
  enabled?: boolean;
  requiresAuth?: boolean;
}

interface EndpointGroup {
  [key: string]: Endpoint[];
}

const EndpointManager: React.FC = () => {
  // This state holds all endpoints for potential future use
  const [_endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [groups, setGroups] = useState<EndpointGroup>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint | null>(null);
  const [showTester, setShowTester] = useState<boolean>(false);
  const [showDetails, setShowDetails] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterMethod, setFilterMethod] = useState<string>('all');

  useEffect(() => {
    fetchEndpoints();
  }, []);

  const fetchEndpoints = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/endpoint-viewer');
      setEndpoints(response.data.routes);
      setGroups(response.data.groups);
      setLoading(false);
    } catch (err) {
      setError('Failed to load endpoints. Please try again later.');
      setLoading(false);
      console.error('Error fetching endpoints:', err);
    }
  };

  const handleTestEndpoint = (endpoint: Endpoint) => {
    setSelectedEndpoint(endpoint);
    setShowTester(true);
  };

  const handleViewDetails = (endpoint: Endpoint) => {
    setSelectedEndpoint(endpoint);
    setShowDetails(true);
  };

  const handleCloseTester = () => {
    setShowTester(false);
    setSelectedEndpoint(null);
  };

  const handleCloseDetails = () => {
    setShowDetails(false);
    setSelectedEndpoint(null);
  };

  const getMethodBadge = (methodWithIndex: string) => {
    // Extract the actual method name (remove the index suffix)
    const method = methodWithIndex.split('-')[0];
    
    const methodColors: { [key: string]: string } = {
      GET: 'primary',
      POST: 'success',
      PUT: 'warning',
      DELETE: 'danger',
      PATCH: 'info',
      OPTIONS: 'secondary',
      HEAD: 'dark'
    };
    
    return (
      <Badge 
        key={methodWithIndex}
        bg={methodColors[method] || 'secondary'} 
        className="me-1"
      >
        {method}
      </Badge>
    );
  };

  const filteredEndpoints = Object.keys(groups).reduce((acc: EndpointGroup, groupName) => {
    const filteredGroup = groups[groupName].filter(endpoint => {
      const matchesSearch = endpoint.path.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesMethod = filterMethod === 'all' || endpoint.methods.includes(filterMethod);
      return matchesSearch && matchesMethod;
    });
    
    if (filteredGroup.length > 0) {
      acc[groupName] = filteredGroup;
    }
    
    return acc;
  }, {});

  if (loading) {
    return (
      <Container className="my-4">
        <Alert variant="info">Loading endpoints...</Alert>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="my-4">
        <Alert variant="danger">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container fluid className="endpoint-manager py-4">
      <h1 className="mb-4">API Endpoint Manager</h1>
      
      <Row className="mb-4">
        <Col md={6}>
          <Form.Group>
            <Form.Control
              type="text"
              placeholder="Search endpoints..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </Form.Group>
        </Col>
        <Col md={4}>
          <Form.Select 
            value={filterMethod} 
            onChange={(e) => setFilterMethod(e.target.value)}
          >
            <option value="all">All Methods</option>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
            <option value="PATCH">PATCH</option>
          </Form.Select>
        </Col>
        <Col md={2}>
          <Button 
            variant="outline-secondary" 
            onClick={() => {
              setSearchTerm('');
              setFilterMethod('all');
            }}
            className="w-100"
          >
            Reset
          </Button>
        </Col>
      </Row>

      <Accordion>
        {Object.keys(filteredEndpoints).sort().map((groupName, index) => (
          <Accordion.Item eventKey={index.toString()} key={groupName}>
            <Accordion.Header>
              <span className="group-name">{groupName}</span>
              <Badge bg="secondary" className="ms-2">
                {filteredEndpoints[groupName].length}
              </Badge>
            </Accordion.Header>
            <Accordion.Body>
              <div className="endpoint-list">
                {filteredEndpoints[groupName].map((endpoint, i) => (
                  <Card key={`${endpoint.path}-${i}`} className="mb-2 endpoint-card">
                    <Card.Body>
                      <Row>
                        <Col md={7}>
                          <div className="d-flex align-items-center mb-2">
                            {endpoint.methods.map((method, index) => 
                              getMethodBadge(method + '-' + index)
                            )}
                            <code className="ms-2 endpoint-path">{endpoint.path}</code>
                          </div>
                          <small className="text-muted">Type: {endpoint.type}</small>
                        </Col>
                        <Col md={5} className="d-flex justify-content-end align-items-center">
                          <Button 
                            variant="outline-info" 
                            size="sm" 
                            className="me-2"
                            onClick={() => handleViewDetails(endpoint)}
                          >
                            Details
                          </Button>
                          <Button 
                            variant="outline-primary" 
                            size="sm"
                            onClick={() => handleTestEndpoint(endpoint)}
                          >
                            Test
                          </Button>
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>
                ))}
              </div>
            </Accordion.Body>
          </Accordion.Item>
        ))}
      </Accordion>

      {/* Endpoint Tester Modal */}
      <Modal 
        show={showTester} 
        onHide={handleCloseTester}
        size="lg"
        backdrop="static"
      >
        <Modal.Header closeButton>
          <Modal.Title>Test Endpoint</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedEndpoint && (
            <EndpointTester endpoint={selectedEndpoint} onClose={handleCloseTester} />
          )}
        </Modal.Body>
      </Modal>

      {/* Endpoint Details Modal */}
      <Modal 
        show={showDetails} 
        onHide={handleCloseDetails}
      >
        <Modal.Header closeButton>
          <Modal.Title>Endpoint Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedEndpoint && (
            <EndpointDetails endpoint={selectedEndpoint} onClose={handleCloseDetails} />
          )}
        </Modal.Body>
      </Modal>
    </Container>
  );
};

export default EndpointManager;
