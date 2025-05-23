import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Form, Button, Alert, Tabs, Tab, Spinner } from 'react-bootstrap';

// Simple JSON tree component to avoid dependency issues
const JSONDisplay: React.FC<{ data: any }> = ({ data }) => {
  const [collapsed, setCollapsed] = useState<boolean>(false);
  
  const formatValue = (value: any): string => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    if (typeof value === 'string') return `"${value}"`;
    return String(value);
  };
  
  const renderObject = (obj: any, level: number = 0): JSX.Element => {
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
                renderObject(value, level + 1)
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
              renderObject(value, level + 1)
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
      {typeof data === 'object' && data !== null ? renderObject(data) : (
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

const EndpointTester: React.FC<EndpointTesterProps> = ({ endpoint, onClose }) => {
  const [selectedMethod, setSelectedMethod] = useState<string>(endpoint.methods[0]);
  const [requestBody, setRequestBody] = useState<string>('{\n  \n}');
  const [requestHeaders, setRequestHeaders] = useState<string>('{\n  "Content-Type": "application/json"\n}');
  const [authToken, setAuthToken] = useState<string>('');
  const [response, setResponse] = useState<any>(null);
  const [responseStatus, setResponseStatus] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('request');

  useEffect(() => {
    // Try to get token from localStorage
    const token = localStorage.getItem('token');
    if (token) {
      setAuthToken(`Bearer ${token}`);
    }
  }, []);

  const handleMethodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedMethod(e.target.value);
  };

  const handleSendRequest = async () => {
    try {
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

      // Build the full URL (handle relative paths)
      const baseUrl = window.location.origin;
      const fullUrl = endpoint.path.startsWith('http') 
        ? endpoint.path 
        : `${baseUrl}${endpoint.path.startsWith('/') ? '' : '/'}${endpoint.path}`;

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
    } catch (err) {
      setError('Invalid JSON in request body');
    }
  };

  const formatHeadersJson = () => {
    try {
      const parsed = JSON.parse(requestHeaders);
      setRequestHeaders(JSON.stringify(parsed, null, 2));
    } catch (err) {
      setError('Invalid JSON in request headers');
    }
  };

  return (
    <div className="endpoint-tester">
      <div className="mb-3">
        <h5>
          <span className={`badge bg-${
            selectedMethod === 'GET' ? 'primary' : 
            selectedMethod === 'POST' ? 'success' : 
            selectedMethod === 'PUT' ? 'warning' : 
            selectedMethod === 'DELETE' ? 'danger' : 
            selectedMethod === 'PATCH' ? 'info' : 'secondary'
          }`}>
            {selectedMethod}
          </span>
          <code className="ms-2">{endpoint.path}</code>
        </h5>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <Tabs
        activeKey={activeTab}
        onSelect={(k) => setActiveTab(k || 'request')}
        className="mb-3"
      >
        <Tab eventKey="request" title="Request">
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Method</Form.Label>
              <Form.Select value={selectedMethod} onChange={handleMethodChange}>
                {endpoint.methods.map(method => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Headers</Form.Label>
              <div className="d-flex mb-2">
                <Button 
                  variant="outline-secondary" 
                  size="sm" 
                  onClick={formatHeadersJson}
                  className="ms-auto"
                >
                  Format
                </Button>
              </div>
              <Form.Control
                as="textarea"
                rows={4}
                value={requestHeaders}
                onChange={(e) => setRequestHeaders(e.target.value)}
                className="font-monospace"
              />
            </Form.Group>

            {selectedMethod !== 'GET' && (
              <Form.Group className="mb-3">
                <Form.Label>Request Body</Form.Label>
                <div className="d-flex mb-2">
                  <Button 
                    variant="outline-secondary" 
                    size="sm" 
                    onClick={formatJson}
                    className="ms-auto"
                  >
                    Format
                  </Button>
                </div>
                <Form.Control
                  as="textarea"
                  rows={8}
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.target.value)}
                  className="font-monospace"
                />
              </Form.Group>
            )}

            <Form.Group className="mb-3">
              <Form.Label>Authorization</Form.Label>
              <Form.Control
                type="text"
                placeholder="Bearer token"
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
              />
              <Form.Text className="text-muted">
                JWT token will be automatically added to the request headers
              </Form.Text>
            </Form.Group>
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
