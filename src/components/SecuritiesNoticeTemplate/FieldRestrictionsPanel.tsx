import React from 'react';
import { OverlayTrigger, Tooltip, Table, Form } from 'react-bootstrap';
import { Lock, ShieldAlert } from 'lucide-react';

/**
 * Phase 4 / US-CCL-01 — FieldRestrictionsPanel
 *
 * Renders a table of template fields with an IS_ENABLED toggle per row.
 *  - PII fields show a red lock icon beside the field name.
 *  - JAFAR-locked fields are disabled (toggle inert + grayed) with a tooltip
 *    explaining the platform-level restriction.
 *  - SECURITY_SYMBOL is required for SECURITIES_FRAUD templates and renders
 *    as a disabled-but-on toggle with a tooltip.
 *
 * Pure presentational — wiring into TemplateBuilder happens in Phase 5.
 */

export interface TemplateField {
  FIELD_ID?: number;
  FIELD_NAME: string;
  FIELD_LABEL?: string;
  IS_PII?: boolean;
  IS_ENABLED?: boolean;
  IS_LOCKED_BY_JAFAR?: boolean;
  IS_READ_ONLY?: boolean;
}

export interface FieldRestrictionsPanelProps {
  fields: TemplateField[];
  /** Field names locked at the platform (JAFAR) level. */
  lockedByJafar: string[];
  /** Called whenever a row toggle changes. Returns the updated field. */
  onChange: (field: TemplateField) => void;
}

const SECURITY_SYMBOL_TOOLTIP =
  'Security Symbol is a required field for Securities Fraud Notice templates and cannot be removed.';
const JAFAR_LOCK_TOOLTIP =
  'This field is restricted at the platform level and cannot be enabled. Contact your platform administrator.';

const FieldRestrictionsPanel: React.FC<FieldRestrictionsPanelProps> = ({
  fields,
  lockedByJafar,
  onChange,
}) => {
  const lockedSet = React.useMemo(() => new Set(lockedByJafar ?? []), [lockedByJafar]);

  return (
    <div className="field-restrictions-panel">
      <Table responsive bordered hover size="sm" className="mb-0">
        <thead className="table-light">
          <tr>
            <th style={{ width: '55%' }}>Field</th>
            <th style={{ width: '20%' }}>Classification</th>
            <th style={{ width: '25%' }} className="text-center">
              Enabled
            </th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => {
            const isJafarLocked = field.IS_LOCKED_BY_JAFAR || lockedSet.has(field.FIELD_NAME);
            const isSecuritySymbol = field.FIELD_NAME === 'SECURITY_SYMBOL';
            const effectiveEnabled = isJafarLocked ? false : isSecuritySymbol ? true : field.IS_ENABLED ?? true;
            const disabled = isJafarLocked || isSecuritySymbol;

            const toggleId = `field-restriction-toggle-${field.FIELD_ID ?? field.FIELD_NAME}`;

            const rowStyle: React.CSSProperties = isJafarLocked
              ? { backgroundColor: '#f8f9fa', color: '#6c757d' }
              : {};

            const toggleNode = (
              <Form.Check
                type="switch"
                id={toggleId}
                checked={effectiveEnabled}
                disabled={disabled}
                onChange={(e) => {
                  if (disabled) return;
                  onChange({ ...field, IS_ENABLED: e.target.checked });
                }}
                aria-label={`Enable field ${field.FIELD_NAME}`}
              />
            );

            const tooltipText = isJafarLocked
              ? JAFAR_LOCK_TOOLTIP
              : isSecuritySymbol
              ? SECURITY_SYMBOL_TOOLTIP
              : null;

            const wrappedToggle = tooltipText ? (
              <OverlayTrigger
                placement="left"
                overlay={
                  <Tooltip id={`${toggleId}-tooltip`}>{tooltipText}</Tooltip>
                }
              >
                <span style={{ display: 'inline-block' }}>{toggleNode}</span>
              </OverlayTrigger>
            ) : (
              toggleNode
            );

            return (
              <tr key={field.FIELD_ID ?? field.FIELD_NAME} style={rowStyle}>
                <td>
                  <div className="d-flex align-items-center gap-2">
                    {field.IS_PII && (
                      <OverlayTrigger
                        placement="top"
                        overlay={
                          <Tooltip id={`${toggleId}-pii-tooltip`}>
                            PII / sensitive field
                          </Tooltip>
                        }
                      >
                        <Lock size={14} color="#C10000" aria-label="PII field" />
                      </OverlayTrigger>
                    )}
                    {isJafarLocked && (
                      <OverlayTrigger
                        placement="top"
                        overlay={
                          <Tooltip id={`${toggleId}-platform-tooltip`}>
                            Platform-locked
                          </Tooltip>
                        }
                      >
                        <ShieldAlert
                          size={14}
                          color="#6c757d"
                          aria-label="Platform-locked field"
                        />
                      </OverlayTrigger>
                    )}
                    <span>{field.FIELD_LABEL ?? field.FIELD_NAME}</span>
                  </div>
                </td>
                <td>
                  {field.IS_PII ? (
                    <span className="badge bg-danger-subtle text-danger">PII</span>
                  ) : (
                    <span className="badge bg-secondary-subtle text-secondary">Standard</span>
                  )}
                </td>
                <td className="text-center">{wrappedToggle}</td>
              </tr>
            );
          })}
          {fields.length === 0 && (
            <tr>
              <td colSpan={3} className="text-center text-muted py-3">
                No fields configured.
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );
};

export default FieldRestrictionsPanel;
