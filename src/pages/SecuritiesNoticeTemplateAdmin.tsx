import React from 'react';
import { Navigate } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import TemplateBuilder from '../components/SecuritiesNoticeTemplate/TemplateBuilder';
import { useAuth } from '../hooks/useAuth';
import { can } from '../utils/permissions';

/**
 * Phase 5 / US-SNT-01 — Securities Fraud Notice Template admin page.
 * Gated on the securitiesNotice.template.create permission key.
 */
const SecuritiesNoticeTemplateAdmin: React.FC = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!can(user, 'securitiesNotice.template.create')) {
    return <Navigate to="/home" replace />;
  }
  return (
    <Container className="py-4">
      <h1 className="mb-4">New Securities Fraud Notice Template</h1>
      <TemplateBuilder />
    </Container>
  );
};

export default SecuritiesNoticeTemplateAdmin;
