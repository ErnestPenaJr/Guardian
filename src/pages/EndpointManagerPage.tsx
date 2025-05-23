import React from 'react';
import { EndpointManager } from '../components/EndpointManager';
import { Container } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';

const EndpointManagerPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Container fluid className="p-0">
      <div className="bg-dark text-white p-3 d-flex justify-content-between align-items-center">
        <h3 className="mb-0">Guardian API Manager</h3>
        <button 
          className="btn btn-outline-light" 
          onClick={() => navigate('/home')}
        >
          Back to Dashboard
        </button>
      </div>
      <EndpointManager />
    </Container>
  );
};

export default EndpointManagerPage;
