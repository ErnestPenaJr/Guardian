import React from 'react';
import { Form, OverlayTrigger, Tooltip } from 'react-bootstrap';

/**
 * Phase 4 / US-CCL-02 — ManagerApprovalToggle
 *
 * Toggle controlling REQUIRES_MANAGER_APPROVAL on a template.
 * Renders disabled with a tooltip when the company has only one configured
 * role (passed in via `soloRoleCompany`). The owning page is responsible for
 * fetching role count from GET /api/users/company-roles-count.
 *
 * Pure presentational — wiring into TemplateBuilder happens in Phase 5.
 */

export interface ManagerApprovalToggleProps {
  value: boolean;
  onChange: (next: boolean) => void;
  /** True when only one distinct role exists in the company. */
  soloRoleCompany: boolean;
  /** Optional label override (defaults to "Require Manager Approval"). */
  label?: string;
}

const SOLO_ROLE_TOOLTIP =
  'Manager Approval requires more than one role to be configured in your environment.';

const ManagerApprovalToggle: React.FC<ManagerApprovalToggleProps> = ({
  value,
  onChange,
  soloRoleCompany,
  label = 'Require Manager Approval',
}) => {
  const toggle = (
    <Form.Check
      type="switch"
      id="manager-approval-toggle"
      label={label}
      checked={soloRoleCompany ? false : value}
      disabled={soloRoleCompany}
      onChange={(e) => {
        if (soloRoleCompany) return;
        onChange(e.target.checked);
      }}
    />
  );

  if (!soloRoleCompany) return toggle;

  return (
    <OverlayTrigger
      placement="right"
      overlay={
        <Tooltip id="manager-approval-toggle-tooltip">{SOLO_ROLE_TOOLTIP}</Tooltip>
      }
    >
      <span style={{ display: 'inline-block' }}>{toggle}</span>
    </OverlayTrigger>
  );
};

export default ManagerApprovalToggle;
