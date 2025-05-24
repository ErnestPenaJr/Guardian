import { useState, useEffect } from 'react';
import { Container, Row, Col, Form, Button, Spinner, Card, Alert, Nav, Tab } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { FaSearch, FaCode, FaCopy, FaLock } from 'react-icons/fa';
// Axios is used in the commented production code section
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import axios from 'axios';

interface Endpoint {
  path: string;
  methods: string[];
  description?: string;
  category: string;
  requiresAuth: boolean;
  parameters?: {
    name: string;
    type: string;
    required: boolean;
    description: string;
  }[];
}

interface ApiResponse {
  data: any;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  timestamp: string;
}

const ApiAccessPortal = (): JSX.Element => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // API Explorer state
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<string>('GET');

  // Response state
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [requestParams, setRequestParams] = useState<Record<string, string>>({});

  // Authentication state
  const [authToken, setAuthToken] = useState<string | null>(
    localStorage.getItem('apiAccessToken') || null
  );

  // State for filtering endpoints by category
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [filteredEndpoints, setFilteredEndpoints] = useState<Endpoint[]>([]);
  
  // Helper function to generate default response data for an endpoint
  const getDefaultResponseData = (endpointPath: string) => {
    return {
      success: true,
      message: 'Operation completed successfully',
      timestamp: new Date().toISOString(),
      data: { result: 'Sample response data for ' + endpointPath }
    };
  };
  
  // Handle parameter input change
  const handleParamChange = (name: string, value: string) => {
    setRequestParams(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Fetch available endpoints
  useEffect(() => {
    const fetchEndpoints = async () => {
      setLoading(true);
      try {
        // In a real app, you would fetch from your API
        // For now, we'll use mock data based on the Prisma schema
        const mockEndpoints: Endpoint[] = [
          // User Management APIs
          {
            path: '/api/users',
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
            description: 'Get all users or create a new user',
            category: 'Users',
            requiresAuth: true,
            parameters: [
              { name: 'FIRST_NAME', type: 'string', required: true, description: 'User first name' },
              { name: 'LAST_NAME', type: 'string', required: true, description: 'User last name' },
              { name: 'EMAIL', type: 'string', required: true, description: 'User email address' },
              { name: 'PASSWORD_HASH', type: 'string', required: true, description: 'Hashed password' },
              { name: 'COMPANY_ID', type: 'number', required: false, description: 'Associated company ID' }
            ]
          },
          {
            path: '/api/users/:id',
            methods: ['GET', 'PUT', 'DELETE'],
            description: 'Get, update or delete a specific user',
            category: 'Users',
            requiresAuth: true,
            parameters: [
              { name: 'id', type: 'number', required: true, description: 'User ID' }
            ]
          },
          
          // Authentication APIs
          {
            path: '/api/auth/login',
            methods: ['POST'],
            description: 'Authenticate user and get JWT token',
            category: 'Authentication',
            requiresAuth: false,
            parameters: [
              { name: 'EMAIL', type: 'string', required: true, description: 'User email' },
              { name: 'PASSWORD', type: 'string', required: true, description: 'User password' }
            ]
          },
          {
            path: '/api/auth/validate-email',
            methods: ['POST'],
            description: 'Validate user email with token',
            category: 'Authentication',
            requiresAuth: false,
            parameters: [
              { name: 'EMAIL_VALIDATION_TOKEN', type: 'string', required: true, description: 'Email validation token' }
            ]
          },
          {
            path: '/api/auth/reset-password',
            methods: ['POST'],
            description: 'Reset user password',
            category: 'Authentication',
            requiresAuth: false,
            parameters: [
              { name: 'PASSWORD_RESET_TOKEN', type: 'string', required: true, description: 'Password reset token' },
              { name: 'NEW_PASSWORD', type: 'string', required: true, description: 'New password' }
            ]
          },
          
          // Request Management APIs
          {
            path: '/api/requests',
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
            description: 'Get all requests or create a new request',
            category: 'Requests',
            requiresAuth: true,
            parameters: [
              { name: 'REQUEST_NAME', type: 'string', required: true, description: 'Request name' },
              { name: 'REQUESTOR_ID', type: 'number', required: false, description: 'ID of the requestor' },
              { name: 'ASSIGNED_ID', type: 'number', required: false, description: 'ID of the assigned user' },
              { name: 'STATUS', type: 'string', required: false, description: 'Request status' }
            ]
          },
          {
            path: '/api/requests/:id',
            methods: ['GET', 'PUT', 'DELETE'],
            description: 'Get, update or delete a specific request',
            category: 'Requests',
            requiresAuth: true,
            parameters: [
              { name: 'id', type: 'number', required: true, description: 'Request ID' }
            ]
          },
          
          // Company Management APIs
          {
            path: '/api/companies',
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
            description: 'Get all companies or create a new company',
            category: 'Companies',
            requiresAuth: true,
            parameters: [
              { name: 'NAME', type: 'string', required: true, description: 'Company name' },
              { name: 'ADDRESS', type: 'string', required: false, description: 'Company address' },
              { name: 'PHONE', type: 'string', required: false, description: 'Company phone number' }
            ]
          },
          {
            path: '/api/companies/:id',
            methods: ['GET', 'PUT', 'DELETE'],
            description: 'Get, update or delete a specific company',
            category: 'Companies',
            requiresAuth: true,
            parameters: [
              { name: 'id', type: 'number', required: true, description: 'Company ID' }
            ]
          },
          
          // Organization APIs
          {
            path: '/api/organizations',
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
            description: 'Get all organizations or create a new organization',
            category: 'Organizations',
            requiresAuth: true,
            parameters: [
              { name: 'COMPANY_NAME', type: 'string', required: true, description: 'Organization company name' },
              { name: 'WORK_SPACE', type: 'string', required: false, description: 'Organization workspace' },
              { name: 'STATUS', type: 'string', required: false, description: 'Organization status' }
            ]
          },
          {
            path: '/api/organizations/:id',
            methods: ['GET', 'PUT', 'DELETE'],
            description: 'Get, update or delete a specific organization',
            category: 'Organizations',
            requiresAuth: true,
            parameters: [
              { name: 'id', type: 'number', required: true, description: 'Organization ID' }
            ]
          },
          
          // Form Management APIs
          {
            path: '/api/forms',
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
            description: 'Get all forms or create a new form',
            category: 'Forms',
            requiresAuth: true,
            parameters: [
              { name: 'FORM_NAME', type: 'string', required: true, description: 'Form name' },
              { name: 'FORM_DESCRIPTION', type: 'string', required: true, description: 'Form description' },
              { name: 'ORGANIZATION_ID', type: 'number', required: false, description: 'Organization ID' },
              { name: 'IS_PUBLIC', type: 'boolean', required: false, description: 'Whether the form is public' },
              { name: 'IS_ACTIVE', type: 'boolean', required: false, description: 'Whether the form is active' }
            ]
          },
          {
            path: '/api/forms/:id',
            methods: ['GET', 'PUT', 'DELETE'],
            description: 'Get, update or delete a specific form',
            category: 'Forms',
            requiresAuth: true,
            parameters: [
              { name: 'id', type: 'number', required: true, description: 'Form ID' }
            ]
          },
          
          // Field Management APIs
          {
            path: '/api/fields',
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
            description: 'Get all fields or create a new field',
            category: 'Fields',
            requiresAuth: true,
            parameters: [
              { name: 'FIELD_NAME', type: 'string', required: true, description: 'Field name' },
              { name: 'FIELD_TYPE_ID', type: 'number', required: true, description: 'Field type ID' },
              { name: 'DISPLAY_FORMAT', type: 'string', required: false, description: 'Display format' },
              { name: 'HAS_LOOKUP', type: 'boolean', required: false, description: 'Whether the field has lookup values' },
              { name: 'IS_REQUIRED', type: 'boolean', required: false, description: 'Whether the field is required' }
            ]
          },
          {
            path: '/api/fields/:id',
            methods: ['GET', 'PUT', 'DELETE'],
            description: 'Get, update or delete a specific field',
            category: 'Fields',
            requiresAuth: true,
            parameters: [
              { name: 'id', type: 'number', required: true, description: 'Field ID' }
            ]
          },
          
          // Role Management APIs
          {
            path: '/api/roles',
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
            description: 'Get all roles or create a new role',
            category: 'Roles',
            requiresAuth: true,
            parameters: [
              { name: 'NAME', type: 'string', required: true, description: 'Role name' },
              { name: 'DISPLAY_NAME', type: 'string', required: true, description: 'Role display name' },
              { name: 'DESCRIPTION', type: 'string', required: true, description: 'Role description' },
              { name: 'STATUS', type: 'string', required: false, description: 'Role status' }
            ]
          },
          {
            path: '/api/roles/:id',
            methods: ['GET', 'PUT', 'DELETE'],
            description: 'Get, update or delete a specific role',
            category: 'Roles',
            requiresAuth: true,
            parameters: [
              { name: 'id', type: 'number', required: true, description: 'Role ID' }
            ]
          },
          
          // Invite Management APIs
          {
            path: '/api/invites',
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
            description: 'Get all invites or create a new invite',
            category: 'Invites',
            requiresAuth: true,
            parameters: [
              { name: 'EMAIL', type: 'string', required: true, description: 'Invitee email' },
              { name: 'ROLE_ID', type: 'number', required: true, description: 'Role ID' },
              { name: 'COMPANY_ID', type: 'number', required: true, description: 'Company ID' },
              { name: 'TOKEN', type: 'string', required: true, description: 'Invite token' },
              { name: 'STATUS', type: 'string', required: true, description: 'Invite status' },
              { name: 'EXPIRES_AT', type: 'datetime', required: true, description: 'Expiration date' }
            ]
          },
          {
            path: '/api/invites/:id',
            methods: ['GET', 'PUT', 'DELETE'],
            description: 'Get, update or delete a specific invite',
            category: 'Invites',
            requiresAuth: true,
            parameters: [
              { name: 'id', type: 'number', required: true, description: 'Invite ID' }
            ]
          },
          
          // Attachment APIs
          {
            path: '/api/attachments',
            methods: ['GET', 'POST', 'DELETE'],
            description: 'Get all attachments or upload a new attachment',
            category: 'Attachments',
            requiresAuth: true,
            parameters: [
              { name: 'REQUEST_ID', type: 'number', required: true, description: 'Request ID' },
              { name: 'FILE_NAME', type: 'string', required: true, description: 'File name' },
              { name: 'ATTACHMENT', type: 'binary', required: false, description: 'File data' }
            ]
          },
          {
            path: '/api/attachments/:id',
            methods: ['GET', 'DELETE'],
            description: 'Get or delete a specific attachment',
            category: 'Attachments',
            requiresAuth: true,
            parameters: [
              { name: 'id', type: 'number', required: true, description: 'Attachment ID' }
            ]
          },
          
          // Task Management APIs
          {
            path: '/api/tasks',
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
            description: 'Get all tasks or create a new task',
            category: 'Tasks',
            requiresAuth: true,
            parameters: [
              { name: 'REQUEST_ID', type: 'number', required: true, description: 'Request ID' },
              { name: 'STATUS', type: 'string', required: true, description: 'Task status' },
              { name: 'ASSIGNED_USER_ID', type: 'number', required: true, description: 'Assigned user ID' },
              { name: 'DESCRIPTION', type: 'string', required: false, description: 'Task description' },
              { name: 'TRACKINGID', type: 'string', required: false, description: 'Tracking ID' }
            ]
          },
          {
            path: '/api/tasks/:id',
            methods: ['GET', 'PUT', 'DELETE'],
            description: 'Get, update or delete a specific task',
            category: 'Tasks',
            requiresAuth: true,
            parameters: [
              { name: 'id', type: 'number', required: true, description: 'Task ID' }
            ]
          },
          
          // System APIs
          {
            path: '/api/health',
            methods: ['GET'],
            description: 'Health check endpoint',
            category: 'System',
            requiresAuth: false
          }
        ];
        
        setEndpoints(mockEndpoints);
      } catch (err) {
        setError('Failed to fetch endpoints');
        console.error('Error fetching endpoints:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchEndpoints();
  }, []);
  
  // Filter endpoints when category changes
  useEffect(() => {
    if (selectedCategory === 'all') {
      setFilteredEndpoints(endpoints);
    } else {
      setFilteredEndpoints(endpoints.filter(endpoint => endpoint.category === selectedCategory));
    }
    
    // Set default endpoint to /api/auth/login when endpoints are loaded
    if (endpoints.length > 0 && !selectedEndpoint) {
      const loginEndpoint = endpoints.find(endpoint => endpoint.path === '/api/auth/login');
      if (loginEndpoint) {
        setSelectedEndpoint(loginEndpoint);
        setSelectedCategory('Authentication');
      }
    }
  }, [selectedCategory, endpoints, selectedEndpoint]);

  // Handle sending API request
  const handleSendRequest = async () => {
    if (!selectedEndpoint) {
      setError('Please select an endpoint');
      return;
    }
    
    setLoading(true);
    setError(null);
    setResponse(null); // Clear previous response
    
    try {
      console.log('Sending request to endpoint:', selectedEndpoint.path);
      
      // Prepare the request configuration
      // Use window.location.origin as a fallback instead of relying on process.env
      const baseUrl = window.location.origin || 'http://localhost:3001';
      const url = `${baseUrl}${selectedEndpoint.path}`;
      
      // Replace path parameters with values from requestParams
      let finalUrl = url;
      if (url.includes(':')) {
        const pathParams = url.match(/:[a-zA-Z0-9_]+/g) || [];
        pathParams.forEach(param => {
          const paramName = param.substring(1); // Remove the colon
          if (requestParams[paramName]) {
            finalUrl = finalUrl.replace(param, requestParams[paramName]);
          }
        });
      }
      
      console.log('Final URL:', finalUrl);
      console.log('Request params:', requestParams);
      
      // Prepare request data
      const config: any = {
        method: selectedMethod,
        url: finalUrl,
        headers: {
          'Content-Type': 'application/json'
        }
      };
      
      // Add auth token if endpoint requires authentication or if we have a stored token
      // For admin users, we'll automatically add the token for all endpoints
      if (selectedEndpoint.requiresAuth || user?.roles?.some((role: any) => role.id === 1 || role.id === 6) || user?.role === '1' || user?.role === '6' || authToken) {
        // Try to get token from localStorage or from the auth context
        const token = authToken || localStorage.getItem('apiAccessToken') || user?.token;
        if (token) {
          config.headers['Authorization'] = `Bearer ${token}`;
          console.log('Added auth token to request');
        } else if (selectedEndpoint.requiresAuth) {
          // Only show error for endpoints that actually require auth
          setError('Authentication required. Please log in first.');
          setLoading(false);
          return;
        }
      }
      
      // Add request body for non-GET requests
      if (selectedMethod !== 'GET' && selectedMethod !== 'DELETE') {
        // Filter out path parameters from the request body
        const bodyParams = { ...requestParams };
        const pathParamNames = (finalUrl.match(/:[a-zA-Z0-9_]+/g) || []).map(p => p.substring(1));
        pathParamNames.forEach(param => {
          delete bodyParams[param];
        });
        
        config.data = bodyParams;
        console.log('Request body:', bodyParams);
      }
      
      // For development/demo purposes, simulate the response
      console.log('Simulating API response...');
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Generate appropriate mock response based on the endpoint
      let responseData: any;
      
      // Check if it's a specific user endpoint
      if (selectedEndpoint.path === '/api/users/:id' && requestParams.id) {
        const userId = requestParams.id;
        responseData = {
          success: true,
          message: `User with ID ${userId} retrieved successfully`,
          timestamp: new Date().toISOString(),
          data: { 
            id: parseInt(userId), 
            firstName: 'Ernest', 
            lastName: 'Pena', 
            email: 'ernest@shieldlytics.com', 
            roles: [{ id: 1, name: 'ADMIN', displayName: 'Administrator' }],
            company: { id: 14, name: 'DEV-TEAM' }
          }
        };
      }
      // Check if it's the login endpoint
      else if (selectedEndpoint.path === '/api/auth/login') {
        // Try to get actual user data from localStorage
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          try {
            const userData = JSON.parse(storedUser);
            // Generate a token for the login response
            const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ';
            
            // Store the token in state and localStorage for future requests
            setAuthToken(token);
            localStorage.setItem('apiAccessToken', token);
            
            responseData = {
              success: true,
              message: 'Authentication successful',
              timestamp: new Date().toISOString(),
              data: {
                token: token,
                user: userData
              }
            };
          } catch (e) {
            console.error('Error parsing user data from localStorage:', e);
            responseData = getDefaultResponseData(selectedEndpoint.path);
          }
        } else {
          responseData = getDefaultResponseData(selectedEndpoint.path);
        }
      } 
      // Check if it's a users endpoint
      else if (selectedEndpoint.path.includes('users')) {
        responseData = {
          success: true,
          message: 'Users retrieved successfully',
          timestamp: new Date().toISOString(),
          data: [{ id: 1036, firstName: 'Ernest', lastName: 'Pena', email: 'ernest@shieldlytics.com', roles: [{ id: 1, name: 'ADMIN', displayName: 'Administrator' }] }]
        };
      } 
      // Default response for other endpoints
      else {
        responseData = getDefaultResponseData(selectedEndpoint.path);
      }
      
      console.log('Generated response data:', responseData);
      
      const mockResponse: ApiResponse = {
        data: responseData,
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'application/json',
          'x-powered-by': 'Guardian API'
        },
        timestamp: new Date().toISOString()
      };
      
      console.log('Setting response:', mockResponse);
      
      // Ensure the response data is properly structured for all endpoints
      // This is critical for displaying responses consistently
      let formattedData = mockResponse.data;
      
      // Make sure we have a consistent response structure
      if (typeof formattedData !== 'object' || formattedData === null) {
        formattedData = { result: formattedData };
      }
      
      // Create a properly structured response that's compatible with browser extensions
      const compatibleResponse: ApiResponse = {
        ...mockResponse,
        data: {
          ...formattedData,
          // Add any properties that extensions might be looking for
          databc: null, // Add this to prevent extensions from throwing errors
        }
      };
      
      console.log('Final formatted response:', compatibleResponse);
      setResponse(compatibleResponse);
      
      // Uncomment for production use with real API
      /*
      const result = await axios(config);
      const apiResponse: ApiResponse = {
        data: result.data,
        status: result.status,
        statusText: result.statusText,
        headers: result.headers as Record<string, string>,
        timestamp: new Date().toISOString()
      };
      setResponse(apiResponse);
      */
    } catch (err: any) {
      console.error('Error sending request:', err);
      setError(`Failed to send request: ${err.message || 'Unknown error'}`);
      
      // Handle error response
      if (err.response) {
        setResponse({
          data: err.response.data,
          status: err.response.status,
          statusText: err.response.statusText,
          headers: err.response.headers,
          timestamp: new Date().toISOString()
        });
      }
    } finally {
      setLoading(false);
    }
  };
  // Generate React code example for the selected endpoint
  const generateReactCode = () => {
    if (!selectedEndpoint) return '';
    
    return `import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ApiExample = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await axios({
        method: '${selectedMethod}',
        url: '${selectedEndpoint.path}',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer YOUR_API_KEY_HERE'
        }
      });
      setData(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={fetchData} disabled={loading}>
        {loading ? 'Loading...' : 'Send Request'}
      </button>
      {error && <div className="error">{error}</div>}
      {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
    </div>
  );
};

export default ApiExample;`;
  };

  // Check user permissions - allow both admin (role_id 1) and JAFAR (role_id 6) users
  if (!user || (!user.roles?.some((role: any) => role.id === 1 || role.id === 6) && user.role !== '1' && user.role !== '6')) {
    return (
      <Container className="mt-5">
        <Alert variant="danger">
          <Alert.Heading>Access Denied</Alert.Heading>
          <p>You do not have permission to access the API Portal. Please contact an administrator.</p>
          <Button variant="outline-danger" onClick={() => navigate('/')}>Return to Dashboard</Button>
        </Alert>
      </Container>
    );
  }

  // Get unique categories for filtering
  const categories = ['all', ...new Set(endpoints.map(endpoint => endpoint.category))].sort();

  return (
    <div style={{ backgroundColor: '#4dabf7', minHeight: '100vh', padding: '20px' }}>
      <Container fluid>
        
        <Row className="mb-4">
          {/* Admin Access Indicator */}
          <Col xs={12} className="mb-3">
            {(user?.roles?.some((role: any) => role.id === 1 || role.id === 6) || user?.role === '1' || user?.role === '6') && (
              <Alert variant="info" className="d-flex align-items-center">
                <FaLock className="me-2" /> 
                <div>
                  <strong>Admin Access Enabled:</strong> You have full access to all API endpoints with automatic authentication.
                </div>
              </Alert>
            )}
          </Col>

          {/* Category Filter */}
          <Col xs={12} className="mb-4">
            <Card className="shadow-sm">
              <Card.Header className="bg-primary text-white">
                <h5 className="mb-0">API Categories</h5>
              </Card.Header>
              <Card.Body>
                <Nav variant="pills" className="flex-row flex-wrap">
                  {categories.map(category => (
                    <Nav.Item key={category}>
                      <Nav.Link 
                        active={selectedCategory === category}
                        onClick={() => {
                          // Reset API Explorer state when category changes
                          setSelectedCategory(category);
                          setSelectedEndpoint(null);
                          setSelectedMethod('GET');
                          setRequestParams({});
                          setResponse(null);
                          setError(null);
                        }}
                        className="mb-2 me-2"
                      >
                        {category === 'all' ? 'All APIs' : category}
                      </Nav.Link>
                    </Nav.Item>
                  ))}
                </Nav>
              </Card.Body>
            </Card>
          </Col>

          {/* API Explorer Panel */}
          <Col md={6}>
            <Card className="shadow-sm mb-4">
              <Card.Header className="bg-primary text-white">
                <h5 className="mb-0 d-flex align-items-center">
                  <FaSearch className="me-2" /> <span>API Explorer</span>
                </h5>
              </Card.Header>
              <Card.Body>
                <Form>
                  <Form.Group className="mb-3">
                    <Form.Label>API Endpoint</Form.Label>
                    <Form.Select 
                      value={selectedEndpoint?.path || ''}
                      onChange={(e) => {
                        const endpoint = endpoints.find(ep => ep.path === e.target.value);
                        setSelectedEndpoint(endpoint || null);
                      }}
                    >
                      <option value="">Select an endpoint</option>
                      {filteredEndpoints.map((endpoint) => (
                        <option key={endpoint.path} value={endpoint.path}>
                          {endpoint.path}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                  
                  {selectedEndpoint && (
                    <>
                      <Form.Group className="mb-3">
                        <Form.Label>Description:</Form.Label>
                        <div className="p-2 bg-light rounded">
                          {selectedEndpoint.description}
                        </div>
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label>Authentication Required:</Form.Label>
                        <div className="p-2 bg-light rounded">
                          {selectedEndpoint.requiresAuth ? (
                            (user?.roles?.some((role: any) => role.id === 1 || role.id === 6) || user?.role === '1' || user?.role === '6') ? (
                              <span className="text-success">
                                <FaLock className="me-1" /> Yes (Automatically Authenticated as Admin)
                              </span>
                            ) : (
                              <span className="text-danger"><FaLock className="me-1" /> Yes</span>
                            )
                          ) : (
                            <span className="text-success">No</span>
                          )}
                        </div>
                      </Form.Group>
                    </>
                  )}
                  
                  <Form.Group className="mb-3">
                    <Form.Label>Method</Form.Label>
                    <Form.Select
                      value={selectedMethod}
                      onChange={(e) => setSelectedMethod(e.target.value)}
                      disabled={!selectedEndpoint}
                    >
                      {selectedEndpoint?.methods.map(method => (
                        <option key={method} value={method}>{method}</option>
                      )) || <option value="GET">GET</option>}
                    </Form.Select>
                  </Form.Group>

                  {selectedEndpoint?.parameters && selectedEndpoint.parameters.length > 0 && (
                    <Form.Group className="mb-3">
                      <Form.Label>Parameters:</Form.Label>
                      <div className="table-responsive">
                        <table className="table table-sm table-bordered">
                          <thead className="table-light">
                            <tr>
                              <th>Name</th>
                              <th>Type</th>
                              <th>Required</th>
                              <th>Value</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedEndpoint.parameters.map((param, idx) => (
                              <tr key={idx}>
                                <td>
                                  <code>{param.name}</code>
                                  <div className="small text-muted">{param.description}</div>
                                </td>
                                <td>{param.type}</td>
                                <td>{param.required ? 'Yes' : 'No'}</td>
                                <td>
                                  <Form.Control
                                    size="sm"
                                    type={param.type === 'number' ? 'number' : 'text'}
                                    placeholder={`Enter ${param.name}`}
                                    value={requestParams[param.name] || ''}
                                    onChange={(e) => handleParamChange(param.name, e.target.value)}
                                    required={param.required}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Form.Group>
                  )}
                  
                  <Button 
                    variant="primary" 
                    onClick={handleSendRequest} 
                    disabled={!selectedEndpoint || loading}
                    className="w-100"
                  >
                    {loading ? (
                      <>
                        <Spinner as="span" animation="border" size="sm" className="me-2" />
                        Sending...
                      </>
                    ) : 'Send Request'}
                  </Button>
                </Form>
              </Card.Body>
            </Card>
          </Col>
          
          {/* Response Panel */}
          <Col md={6}>
            <Card className="shadow-sm mb-4">
              <Card.Header className="bg-primary text-white">
                <h5 className="mb-0 d-flex align-items-center">
                  <FaCode className="me-2" /> <span>Response</span>
                </h5>
              </Card.Header>
              <Card.Body style={{ minHeight: '300px', fontFamily: 'monospace' }}>
                {loading ? (
                  <div className="text-center py-5">
                    <Spinner animation="border" />
                    <p className="mt-3">Sending request...</p>
                  </div>
                ) : response ? (
                  <>
                    <div className="d-flex justify-content-between mb-2">
                      <span className="badge bg-success">Status: {response.status} {response.statusText}</span>
                      <Button size="sm" variant="outline-secondary" onClick={() => navigator.clipboard.writeText(JSON.stringify(response.data, null, 2))}>
                        <FaCopy className="me-1" /> Copy
                      </Button>
                    </div>
                    <pre style={{ whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(response.data, null, 2)}
                    </pre>
                  </>
                ) : (
                  <div className="text-muted">No response yet</div>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
        
        {/* React Code Example Section */}
        <Row>
          <Col xs={12}>
            <Card className="shadow-sm">
              <Card.Header className="bg-primary text-white d-flex justify-content-between align-items-center">
                <h5 className="mb-0">
                  <FaCode className="me-2" /> React TypeScript Code Example
                </h5>
                <Button variant="light" size="sm" onClick={() => navigator.clipboard.writeText(generateReactCode())}>
                  <FaCopy /> Copy Code
                </Button>
              </Card.Header>
              <Card.Body>
                <h6>How to Use the API with React and TypeScript</h6>
                <p>Below is an example of how to call this API endpoint using React, TypeScript, and Axios:</p>
                
                {selectedEndpoint ? (
                  <Tab.Container defaultActiveKey="react">
                    <Nav variant="tabs" className="mb-3">
                      <Nav.Item>
                        <Nav.Link eventKey="react">React + TypeScript</Nav.Link>
                      </Nav.Item>
                      <Nav.Item>
                        <Nav.Link eventKey="axios">Axios Config</Nav.Link>
                      </Nav.Item>
                    </Nav>
                    <Tab.Content>
                      <Tab.Pane eventKey="react">
                        <pre style={{ backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '5px' }}>
                          {generateReactCode()}
                        </pre>
                      </Tab.Pane>
                      <Tab.Pane eventKey="axios">
                        <pre style={{ backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '5px' }}>
                          {`// Axios configuration for ${selectedEndpoint.path}
const config = {
  method: '${selectedMethod}',
  url: '${selectedEndpoint.path}',
  headers: {
    'Content-Type': 'application/json',
    ${selectedEndpoint.requiresAuth ? "'Authorization': 'Bearer YOUR_JWT_TOKEN_HERE'," : ''}
  },
  ${selectedMethod !== 'GET' ? "data: { /* request body parameters */ }," : ''}
};

// Make the API call
axios(config)
  .then(response => console.log(response.data))
  .catch(error => console.error(error));`}
                        </pre>
                      </Tab.Pane>
                    </Tab.Content>
                  </Tab.Container>
                ) : (
                  <Alert variant="info">
                    <span className="me-2">ℹ️</span>
                    Select an endpoint to see a React/TypeScript code example
                  </Alert>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
        
        {error && (
          <Alert variant="danger" className="mt-3">
            {error}
          </Alert>
        )}
      </Container>
    </div>
  );
};

export default ApiAccessPortal;
