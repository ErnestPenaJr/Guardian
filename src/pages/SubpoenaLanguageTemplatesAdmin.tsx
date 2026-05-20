import React from 'react';
import { Navigate } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import SubpoenaLanguageBuilder from '../components/SubpoenaRider/SubpoenaLanguageBuilder';
import { useAuth } from '../hooks/useAuth';
import { can } from '../utils/permissions';

/**
 * Phase 7 / US-SRB-01 — Subpoena Language Template admin page.
 *
 * Wraps the existing SubpoenaLanguageBuilder card so admins (role 1) and
 * super admins (role 6) have a directly addressable route. Without this
 * page the builder was built but never reachable, and Processors hit the
 * "No subpoena template is configured for this fraud type" wall when
 * trying to generate a rider.
 */
const SubpoenaLanguageTemplatesAdmin: React.FC = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!can(user, 'subpoenaRider.configureLanguage')) {
    return <Navigate to="/home" replace />;
  }
  return (
    <Container className="py-4">
      <h1 className="mb-4">Subpoena Language Templates</h1>
      <SubpoenaLanguageBuilder />
    </Container>
  );
};

export default SubpoenaLanguageTemplatesAdmin;
