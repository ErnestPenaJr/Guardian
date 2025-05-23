import React from 'react';
import { Card, Badge, ListGroup } from 'react-bootstrap';

interface EndpointDetailsProps {
  endpoint: {
    path: string;
    methods: string[];
    type: string;
    description?: string;
    requiresAuth?: boolean;
  };
  onClose: () => void;
}

const EndpointDetails: React.FC<EndpointDetailsProps> = ({ endpoint }) => {
  // Determine if endpoint likely requires authentication based on path
  const likelyRequiresAuth = 
    !endpoint.path.includes('/health') && 
    !endpoint.path.includes('/login') && 
    !endpoint.path.includes('/register') && 
    !endpoint.path.includes('/validate-email') &&
    !endpoint.path.includes('/verify-email') &&
    !endpoint.path.includes('/request-password-reset') &&
    !endpoint.path.includes('/reset-password');

  // Generate description based on path and methods
  const generateDescription = () => {
    if (endpoint.description) return endpoint.description;
    
    const pathParts = endpoint.path.split('/').filter(Boolean);
    const lastPart = pathParts[pathParts.length - 1];
    const secondLastPart = pathParts[pathParts.length - 2];
    
    if (endpoint.path === '/health') {
      return 'Health check endpoint to verify the API is running correctly.';
    }
    
    if (endpoint.path.includes('/login')) {
      return 'Authenticates a user and returns a JWT token.';
    }
    
    if (endpoint.path.includes('/logout')) {
      return 'Logs out the current user.';
    }
    
    if (endpoint.path.includes('/register')) {
      return 'Registers a new user account.';
    }
    
    if (endpoint.methods.includes('GET')) {
      if (endpoint.path.includes(':id')) {
        return `Retrieves a specific ${secondLastPart} by ID.`;
      }
      return `Lists all ${lastPart || secondLastPart || 'resources'}.`;
    }
    
    if (endpoint.methods.includes('POST')) {
      return `Creates a new ${lastPart || secondLastPart || 'resource'}.`;
    }
    
    if (endpoint.methods.includes('PUT')) {
      return `Updates an existing ${secondLastPart || 'resource'}.`;
    }
    
    if (endpoint.methods.includes('DELETE')) {
      return `Deletes a ${secondLastPart || 'resource'}.`;
    }
    
    return `Endpoint for ${lastPart || secondLastPart || 'API operations'}.`;
  };
  
  // Determine endpoint category
  const getEndpointCategory = () => {
    if (endpoint.path.includes('/health')) return 'System';
    if (endpoint.path.includes('/login') || endpoint.path.includes('/logout')) return 'Authentication';
    if (endpoint.path.includes('/register') || endpoint.path.includes('/user')) return 'User Management';
    if (endpoint.path.includes('/form')) return 'Forms';
    if (endpoint.path.includes('/request')) return 'Requests';
    if (endpoint.path.includes('/invite')) return 'Invitations';
    
    return 'API';
  };
  
  // Determine expected response codes
  const getExpectedResponseCodes = () => {
    const codes = [];
    
    // Success codes
    if (endpoint.methods.includes('GET')) codes.push('200 - OK');
    if (endpoint.methods.includes('POST')) codes.push('201 - Created');
    if (endpoint.methods.includes('PUT') || endpoint.methods.includes('PATCH')) codes.push('200 - OK');
    if (endpoint.methods.includes('DELETE')) codes.push('204 - No Content');
    
    // Error codes
    codes.push('400 - Bad Request');
    if (likelyRequiresAuth) codes.push('401 - Unauthorized');
    if (endpoint.path.includes('admin')) codes.push('403 - Forbidden');
    if (endpoint.methods.includes('GET') || endpoint.methods.includes('PUT') || endpoint.methods.includes('DELETE')) {
      codes.push('404 - Not Found');
    }
    codes.push('500 - Internal Server Error');
    
    return codes;
  };
  
  return (
    <div className="endpoint-details">
      <Card className="mb-3">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Endpoint Information</h5>
          <Badge bg="secondary">{getEndpointCategory()}</Badge>
        </Card.Header>
        <Card.Body>
          <div className="mb-3">
            <strong>Path:</strong> <code>{endpoint.path}</code>
          </div>
          <div className="mb-3">
            <strong>Methods:</strong>{' '}
            {endpoint.methods.map(method => (
              <Badge 
                key={method}
                bg={
                  method === 'GET' ? 'primary' : 
                  method === 'POST' ? 'success' : 
                  method === 'PUT' ? 'warning' : 
                  method === 'DELETE' ? 'danger' : 
                  method === 'PATCH' ? 'info' : 'secondary'
                }
                className="me-1"
              >
                {method}
              </Badge>
            ))}
          </div>
          <div className="mb-3">
            <strong>Type:</strong> {endpoint.type}
          </div>
          <div className="mb-3">
            <strong>Description:</strong> {generateDescription()}
          </div>
          <div className="mb-3">
            <strong>Authentication Required:</strong>{' '}
            <Badge bg={likelyRequiresAuth ? 'warning' : 'success'}>
              {likelyRequiresAuth ? 'Yes' : 'No'}
            </Badge>
          </div>
        </Card.Body>
      </Card>
      
      <Card>
        <Card.Header>
          <h5 className="mb-0">Expected Response Codes</h5>
        </Card.Header>
        <ListGroup variant="flush">
          {getExpectedResponseCodes().map((code, index) => (
            <ListGroup.Item key={index}>
              {code}
            </ListGroup.Item>
          ))}
        </ListGroup>
      </Card>
    </div>
  );
};

export default EndpointDetails;
