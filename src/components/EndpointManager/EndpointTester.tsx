import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Form, Button, Alert, Tabs, Tab, Spinner, Card, InputGroup, Badge } from 'react-bootstrap';

// Simple JSON tree component to avoid dependency issues
const JSONDisplay: React.FC<{ data: unknown }> = ({ data }) => {
  const [collapsed, setCollapsed] = useState<boolean>(false);
  
  const formatValue = (value: unknown): string => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    if (typeof value === 'string') return `"${value}"`;
    return String(value);
  };
  
  const renderObject = (obj: Record<string, unknown> | unknown[], level: number = 0): JSX.Element => {
    const indent = '  '.repeat(level);
    const entries = Object.entries(obj);
    
    if (collapsed) {
      return (
        <div className="json-collapsed" onClick={() => setCollapsed(false)}>
          {Array.isArray(obj) ? '[...]' : '{...}'} <span className="text-muted">{entries.length} items</span>
        </div>
      );
    }
    
    if (Array.isArray(obj)) {
      return (
        <div className="json-array">
          <div className="json-bracket" onClick={() => setCollapsed(true)}>[</div>
          {entries.map(([key, value], index) => (
            <div key={key} className="json-line">
              {indent}  {typeof value === 'object' && value !== null ? (
                renderObject(value as Record<string, unknown> | unknown[], level + 1)
              ) : (
                <span className={`json-value json-${typeof value}`}>{formatValue(value)}</span>
              )}{index < entries.length - 1 ? ',' : ''}
            </div>
          ))}
          <div>{indent}]</div>
        </div>
      );
    }
    
    return (
      <div className="json-object">
        <div className="json-bracket" onClick={() => setCollapsed(true)}>{"{"}  <span className="text-muted cursor-pointer">{entries.length} keys</span></div>
        {entries.map(([key, value], index) => (
          <div key={key} className="json-line">
            {indent}  <span className="json-key">"{key}"</span>: {typeof value === 'object' && value !== null ? (
              renderObject(value as Record<string, unknown> | unknown[], level + 1)
            ) : (
              <span className={`json-value json-${typeof value}`}>{formatValue(value)}</span>
            )}{index < entries.length - 1 ? ',' : ''}
          </div>
        ))}
        <div>{indent}{"}"}  </div>
      </div>
    );
  };
  
  return (
    <div className="json-tree font-monospace" style={{ backgroundColor: '#f8f9fa', padding: '1rem', borderRadius: '0.25rem', overflow: 'auto' }}>
      {typeof data === 'object' && data !== null ? renderObject(data as Record<string, unknown> | unknown[]) : (
        <span className={`json-value json-${typeof data}`}>{formatValue(data)}</span>
      )}
    </div>
  );
};

interface EndpointTesterProps {
  endpoint: {
    path: string;
    methods: string[];
    type: string;
  };
  onClose: () => void;
}

interface ParamInfo {
  name: string;
  required: boolean;
  type: string;
  description: string;
  value: string;
  in: 'path' | 'query' | 'body' | 'header';
}

const EndpointTester: React.FC<EndpointTesterProps> = ({ endpoint, onClose }) => {
  const [selectedMethod, setSelectedMethod] = useState<string>(endpoint.methods[0]);
  const [requestBody, setRequestBody] = useState<string>('{\n  \n}');
  const [requestHeaders, setRequestHeaders] = useState<string>('{\n  "Content-Type": "application/json"\n}');
  const [authToken, setAuthToken] = useState<string>('');
  const [response, setResponse] = useState<unknown>(null);
  const [responseStatus, setResponseStatus] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('request');
  const [pathParams, setPathParams] = useState<ParamInfo[]>([]);
  const [queryParams, setQueryParams] = useState<ParamInfo[]>([]);
  const [bodyParams, setBodyParams] = useState<ParamInfo[]>([]);
  const [headerParams, setHeaderParams] = useState<ParamInfo[]>([]);

  // Define extractEndpointParams before it's used in useEffect
  const extractEndpointParams = () => {
    // Extract path parameters (e.g., /api/users/:id)
    const pathRegex = /:([\w-]+)/g;
    const path = endpoint.path;
    const pathMatches = [...path.matchAll(pathRegex)];
    
    const extractedPathParams: ParamInfo[] = pathMatches.map(match => ({
      name: match[1],
      required: true,
      type: 'string',
      description: `Path parameter: ${match[1]}`,
      value: '',
      in: 'path'
    }));
    
    setPathParams(extractedPathParams);
    
    // Guess some common query parameters based on the endpoint path
    const extractedQueryParams: ParamInfo[] = [];
    
    if (path.includes('/users') && selectedMethod === 'GET') {
      extractedQueryParams.push({
        name: 'limit',
        required: false,
        type: 'number',
        description: 'Number of records to return',
        value: '10',
        in: 'query'
      });
      extractedQueryParams.push({
        name: 'offset',
        required: false,
        type: 'number',
        description: 'Number of records to skip',
        value: '0',
        in: 'query'
      });
    }
    
    if (path.includes('/search')) {
      extractedQueryParams.push({
        name: 'q',
        required: true,
        type: 'string',
        description: 'Search query',
        value: '',
        in: 'query'
      });
    }
    
    setQueryParams(extractedQueryParams);
    
    // Guess some common body parameters based on the endpoint path and method
    const extractedBodyParams: ParamInfo[] = [];
    
    if ((selectedMethod === 'POST' || selectedMethod === 'PUT') && path.includes('/users')) {
      extractedBodyParams.push({
        name: 'email',
        required: true,
        type: 'string',
        description: 'User email',
        value: '',
        in: 'body'
      });
      extractedBodyParams.push({
        name: 'firstName',
        required: true,
        type: 'string',
        description: 'User first name',
        value: '',
        in: 'body'
      });
      extractedBodyParams.push({
        name: 'lastName',
        required: true,
        type: 'string',
        description: 'User last name',
        value: '',
        in: 'body'
      });
    }
    
    if ((selectedMethod === 'POST' || selectedMethod === 'PUT') && path.includes('/login')) {
      extractedBodyParams.push({
        name: 'email',
        required: true,
        type: 'string',
        description: 'User email',
        value: '',
        in: 'body'
      });
      extractedBodyParams.push({
        name: 'password',
        required: true,
        type: 'string',
        description: 'User password',
        value: '',
        in: 'body'
      });
    }
    
    setBodyParams(extractedBodyParams);
    
    // Set common header parameters
    const extractedHeaderParams: ParamInfo[] = [
      {
        name: 'Content-Type',
        required: true,
        type: 'string',
        description: 'Content type of the request',
        value: 'application/json',
        in: 'header'
      }
    ];
    
    if (path.includes('/api/') && !path.includes('/login') && !path.includes('/register')) {
      extractedHeaderParams.push({
        name: 'Authorization',
        required: true,
        type: 'string',
        description: 'Bearer token for authentication',
        value: authToken,
        in: 'header'
      });
    }
    
    setHeaderParams(extractedHeaderParams);
  };
  
  useEffect(() => {
    // Try to get token from localStorage
    const token = localStorage.getItem('token');
    if (token) {
      setAuthToken(`Bearer ${token}`);
    }
    
    // Extract parameters from the endpoint path
    extractEndpointParams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  const handleMethodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedMethod(e.target.value);
    // Re-extract parameters when method changes
    setTimeout(() => extractEndpointParams(), 0);
  };
  
  const handleParamChange = (index: number, value: string, paramType: 'path' | 'query' | 'body' | 'header') => {
    if (paramType === 'path') {
      const updatedParams = [...pathParams];
      updatedParams[index].value = value;
      setPathParams(updatedParams);
    } else if (paramType === 'query') {
      const updatedParams = [...queryParams];
      updatedParams[index].value = value;
      setQueryParams(updatedParams);
    } else if (paramType === 'body') {
      const updatedParams = [...bodyParams];
      updatedParams[index].value = value;
      setBodyParams(updatedParams);
      
      // Update request body JSON
      try {
        const bodyObj = requestBody.trim() ? JSON.parse(requestBody) : {};
        bodyObj[updatedParams[index].name] = value;
        setRequestBody(JSON.stringify(bodyObj, null, 2));
      } catch (_) {
        // If JSON parsing fails, don't update the request body
      }
    } else if (paramType === 'header') {
      const updatedParams = [...headerParams];
      updatedParams[index].value = value;
      setHeaderParams(updatedParams);
      
      // Update request headers JSON
      try {
        const headersObj = requestHeaders.trim() ? JSON.parse(requestHeaders) : {};
        headersObj[updatedParams[index].name] = value;
        setRequestHeaders(JSON.stringify(headersObj, null, 2));
      } catch (_) {
        // If JSON parsing fails, don't update the request headers
      }
    }
  };

  const handleSendRequest = async () => {
    try {
      // Validate required parameters
      const missingPathParams = pathParams.filter((param: ParamInfo) => param.required && !param.value.trim());
      const missingQueryParams = queryParams.filter((param: ParamInfo) => param.required && !param.value.trim());
      const missingBodyParams = bodyParams.filter((param: ParamInfo) => param.required && !param.value.trim());
      const missingHeaderParams = headerParams.filter((param: ParamInfo) => param.required && !param.value.trim());
      
      const allMissingParams = [...missingPathParams, ...missingQueryParams, ...missingBodyParams, ...missingHeaderParams];
      
      if (allMissingParams.length > 0) {
        setError(`Missing required parameters: ${allMissingParams.map(p => p.name).join(', ')}`);
        return;
      }
      
      setLoading(true);
      setError(null);
      setResponse(null);
      setResponseStatus('');
      setActiveTab('response');

      // Parse request body and headers
      let parsedBody = {};
      let parsedHeaders = {};

      try {
        if (requestBody.trim()) {
          parsedBody = JSON.parse(requestBody);
        }
      } catch (err) {
        setError('Invalid JSON in request body');
        setLoading(false);
        return;
      }

      try {
        if (requestHeaders.trim()) {
          parsedHeaders = JSON.parse(requestHeaders);
        }
      } catch (err) {
        setError('Invalid JSON in request headers');
        setLoading(false);
        return;
      }

      // Add authorization header if provided
      if (authToken.trim()) {
        parsedHeaders = {
          ...parsedHeaders,
          Authorization: authToken
        };
      }

      // Build the full URL with path parameters and query parameters
      let processedPath = endpoint.path;
      
      // Replace path parameters
      pathParams.forEach((param: ParamInfo) => {
        processedPath = processedPath.replace(`:${param.name}`, encodeURIComponent(param.value));
      });
      
      // Add query parameters
      if (queryParams.length > 0) {
        const queryString = queryParams
          .filter((param: ParamInfo) => param.value.trim())
          .map((param: ParamInfo) => `${encodeURIComponent(param.name)}=${encodeURIComponent(param.value)}`)
          .join('&');
          
        if (queryString) {
          processedPath += processedPath.includes('?') ? `&${queryString}` : `?${queryString}`;
        }
      }
      
      // Build the full URL (handle relative paths)
      const baseUrl = window.location.origin;
      const fullUrl = processedPath.startsWith('http') 
        ? processedPath 
        : `${baseUrl}${processedPath.startsWith('/') ? '' : '/'}${processedPath}`;

      console.log(`Sending ${selectedMethod} request to: ${fullUrl}`);
      
      // Prepare request options
      const options = {
        method: selectedMethod,
        headers: parsedHeaders,
        data: selectedMethod !== 'GET' ? parsedBody : undefined
      };

      // Send the request
      const startTime = Date.now();
      const response = await axios(fullUrl, options);
      const endTime = Date.now();
      
      setResponse(response.data);
      setResponseStatus(`${response.status} ${response.statusText} (${endTime - startTime}ms)`);
      setLoading(false);
    } catch (err: any) {
      setLoading(false);
      if (err.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        setResponse(err.response.data);
        setResponseStatus(`${err.response.status} ${err.response.statusText}`);
      } else if (err.request) {
        // The request was made but no response was received
        setError('No response received from server');
      } else {
        // Something happened in setting up the request that triggered an Error
        setError(`Error: ${err.message}`);
      }
    }
  };

  const formatJson = () => {
    try {
      const parsed = JSON.parse(requestBody);
      setRequestBody(JSON.stringify(parsed, null, 2));
    } catch (_) {
      setError('Invalid JSON in request body');
    }
  };

  const formatHeadersJson = () => {
    try {
      const parsed = JSON.parse(requestHeaders);
      setRequestHeaders(JSON.stringify(parsed, null, 2));
    } catch (_) {
      setError('Invalid JSON in request headers');
    }
  };

  return (
    <div className="endpoint-tester">
      <Card className="mb-3 border-0 shadow-sm">
        <Card.Header className="bg-light d-flex align-items-center">
          <span className={`badge bg-${
            selectedMethod === 'GET' ? 'primary' : 
            selectedMethod === 'POST' ? 'success' : 
            selectedMethod === 'PUT' ? 'warning' : 
            selectedMethod === 'DELETE' ? 'danger' : 
            selectedMethod === 'PATCH' ? 'info' : 'secondary'
          } me-2`}>
            {selectedMethod}
          </span>
          <code className="endpoint-path flex-grow-1">{endpoint.path}</code>
        </Card.Header>
      </Card>

      {error && <Alert variant="danger">{error}</Alert>}

      <Tabs
        activeKey={activeTab}
        onSelect={(k) => setActiveTab(k || 'request')}
        className="mb-3"
      >
        <Tab eventKey="request" title="Request">
          <Form>
            <Card className="mb-4 shadow-sm">
              <Card.Header className="bg-light">
                <h6 className="mb-0">Request Configuration</h6>
              </Card.Header>
              <Card.Body>
                <Form.Group className="mb-3">
                  <Form.Label>Method</Form.Label>
                  <Form.Select value={selectedMethod} onChange={handleMethodChange}>
                    {endpoint.methods.map(method => (
                      <option key={method} value={method}>{method}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Card.Body>
            </Card>
            
            {/* Path Parameters */}
            {pathParams.length > 0 && (
              <Card className="mb-4 shadow-sm">
                <Card.Header className="bg-light d-flex justify-content-between align-items-center">
                  <h6 className="mb-0">Path Parameters</h6>
                  <Badge bg="info">{pathParams.length}</Badge>
                </Card.Header>
                <Card.Body>
                  {pathParams.map((param: ParamInfo, index: number) => (
                    <Form.Group className="mb-3" key={`path-${param.name}`}>
                      <Form.Label>
                        {param.name}
                        {param.required && <span className="text-danger">*</span>}
                      </Form.Label>
                      <InputGroup>
                        <Form.Control
                          type={param.type === 'number' ? 'number' : 'text'}
                          placeholder={param.description}
                          value={param.value}
                          onChange={(e) => handleParamChange(index, e.target.value, 'path')}
                          required={param.required}
                        />
                      </InputGroup>
                      <Form.Text className="text-muted">
                        {param.description}
                      </Form.Text>
                    </Form.Group>
                  ))}
                </Card.Body>
              </Card>
            )}
            
            {/* Query Parameters */}
            {queryParams.length > 0 && (
              <Card className="mb-4 shadow-sm">
                <Card.Header className="bg-light d-flex justify-content-between align-items-center">
                  <h6 className="mb-0">Query Parameters</h6>
                  <Badge bg="info">{queryParams.length}</Badge>
                </Card.Header>
                <Card.Body>
                  {queryParams.map((param: ParamInfo, index: number) => (
                    <Form.Group className="mb-3" key={`query-${param.name}`}>
                      <Form.Label>
                        {param.name}
                        {param.required && <span className="text-danger">*</span>}
                      </Form.Label>
                      <InputGroup>
                        <Form.Control
                          type={param.type === 'number' ? 'number' : 'text'}
                          placeholder={param.description}
                          value={param.value}
                          onChange={(e) => handleParamChange(index, e.target.value, 'query')}
                          required={param.required}
                        />
                      </InputGroup>
                      <Form.Text className="text-muted">
                        {param.description}
                      </Form.Text>
                    </Form.Group>
                  ))}
                </Card.Body>
              </Card>
            )}
            
            {/* Body Parameters */}
            {selectedMethod !== 'GET' && (
              <>
                {bodyParams.length > 0 && (
                  <Card className="mb-4 shadow-sm">
                    <Card.Header className="bg-light d-flex justify-content-between align-items-center">
                      <h6 className="mb-0">Body Parameters</h6>
                      <Badge bg="info">{bodyParams.length}</Badge>
                    </Card.Header>
                    <Card.Body>
                      {bodyParams.map((param: ParamInfo, index: number) => (
                        <Form.Group className="mb-3" key={`body-${param.name}`}>
                          <Form.Label>
                            {param.name}
                            {param.required && <span className="text-danger">*</span>}
                          </Form.Label>
                          <InputGroup>
                            <Form.Control
                              type={param.type === 'number' ? 'number' : 'text'}
                              placeholder={param.description}
                              value={param.value}
                              onChange={(e) => handleParamChange(index, e.target.value, 'body')}
                              required={param.required}
                            />
                          </InputGroup>
                          <Form.Text className="text-muted">
                            {param.description}
                          </Form.Text>
                        </Form.Group>
                      ))}
                    </Card.Body>
                  </Card>
                )}
                
                <Card className="mb-4 shadow-sm">
                  <Card.Header className="bg-light d-flex justify-content-between align-items-center">
                    <h6 className="mb-0">Request Body (JSON)</h6>
                    <Button 
                      variant="outline-secondary" 
                      size="sm" 
                      onClick={formatJson}
                    >
                      Format
                    </Button>
                  </Card.Header>
                  <Card.Body>
                    <Form.Control
                      as="textarea"
                      rows={8}
                      value={requestBody}
                      onChange={(e) => setRequestBody(e.target.value)}
                      className="font-monospace"
                    />
                  </Card.Body>
                </Card>
              </>
            )}
            
            {/* Header Parameters */}
            {headerParams.length > 0 && (
              <Card className="mb-4 shadow-sm">
                <Card.Header className="bg-light d-flex justify-content-between align-items-center">
                  <h6 className="mb-0">Header Parameters</h6>
                  <Badge bg="info">{headerParams.length}</Badge>
                </Card.Header>
                <Card.Body>
                  {headerParams.map((param: ParamInfo, index: number) => (
                    <Form.Group className="mb-3" key={`header-${param.name}`}>
                      <Form.Label>
                        {param.name}
                        {param.required && <span className="text-danger">*</span>}
                      </Form.Label>
                      <InputGroup>
                        <Form.Control
                          type="text"
                          placeholder={param.description}
                          value={param.value}
                          onChange={(e) => handleParamChange(index, e.target.value, 'header')}
                          required={param.required}
                        />
                      </InputGroup>
                      <Form.Text className="text-muted">
                        {param.description}
                      </Form.Text>
                    </Form.Group>
                  ))}
                </Card.Body>
              </Card>
            )}
            
            <Card className="mb-4 shadow-sm">
              <Card.Header className="bg-light d-flex justify-content-between align-items-center">
                <h6 className="mb-0">Headers (JSON)</h6>
                <Button 
                  variant="outline-secondary" 
                  size="sm" 
                  onClick={formatHeadersJson}
                >
                  Format
                </Button>
              </Card.Header>
              <Card.Body>
                <Form.Control
                  as="textarea"
                  rows={4}
                  value={requestHeaders}
                  onChange={(e) => setRequestHeaders(e.target.value)}
                  className="font-monospace"
                />
              </Card.Body>
            </Card>
          </Form>
        </Tab>

        <Tab eventKey="response" title="Response">
          <div className="response-container">
            {loading ? (
              <div className="text-center py-4">
                <Spinner animation="border" role="status">
                  <span className="visually-hidden">Loading...</span>
                </Spinner>
                <p className="mt-2">Sending request...</p>
              </div>
            ) : response ? (
              <>
                <div className="mb-3">
                  <strong>Status:</strong>{' '}
                  <span className={responseStatus.startsWith('2') ? 'text-success' : 'text-danger'}>
                    {responseStatus}
                  </span>
                </div>
                <div className="response-body">
                  <JSONDisplay data={response} />
                </div>
              </>
            ) : (
              <Alert variant="info">
                Click "Send Request" to see the response here
              </Alert>
            )}
          </div>
        </Tab>
      </Tabs>

      <div className="d-flex justify-content-end mt-4">
        <Button variant="secondary" onClick={onClose} className="me-2">
          Close
        </Button>
        <Button 
          variant="primary" 
          onClick={handleSendRequest}
          disabled={loading}
        >
          {loading ? (
            <>
              <Spinner
                as="span"
                animation="border"
                size="sm"
                role="status"
                aria-hidden="true"
                className="me-2"
              />
              Sending...
            </>
          ) : (
            'Send Request'
          )}
        </Button>
      </div>
    </div>
  );
};

export default EndpointTester;
