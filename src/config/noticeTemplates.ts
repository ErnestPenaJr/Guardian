import { FileText, AlertTriangle, Eye, type LucideIcon } from 'lucide-react';

export type NoticeTemplateId =
  | 'INTEL_DISSEMINATION'
  | 'THREAT_ADVISORY'
  | 'SITUATIONAL_AWARENESS';

export interface NoticeTemplateField {
  key: string;
  label: string;
  type: 'text' | 'textarea';
  required: boolean;
}

export interface NoticeTemplate {
  id: NoticeTemplateId;
  name: string;
  description: string;
  icon: LucideIcon;
  fields: NoticeTemplateField[];
}

export const NOTICE_TEMPLATES: NoticeTemplate[] = [
  {
    id: 'INTEL_DISSEMINATION',
    name: 'Intel dissemination notice',
    description: 'Standard template for distributing finished intelligence',
    icon: FileText,
    fields: [
      { key: 'subject_intel_id', label: 'Subject / intel ID', type: 'text', required: true },
      { key: 'classification_level', label: 'Classification level', type: 'text', required: true },
      { key: 'source_summary', label: 'Source summary', type: 'textarea', required: true },
      { key: 'key_findings', label: 'Key findings', type: 'textarea', required: true },
      { key: 'handling_caveats', label: 'Handling caveats', type: 'text', required: false },
    ],
  },
  {
    id: 'THREAT_ADVISORY',
    name: 'Threat advisory',
    description: 'Urgent template for time-sensitive threat notifications',
    icon: AlertTriangle,
    fields: [
      { key: 'threat_actor', label: 'Threat actor / group', type: 'text', required: true },
      { key: 'threat_type', label: 'Threat type', type: 'text', required: true },
      { key: 'affected_systems', label: 'Affected systems / areas', type: 'text', required: true },
      { key: 'severity', label: 'Severity', type: 'text', required: true },
      { key: 'immediate_actions', label: 'Immediate actions required', type: 'textarea', required: true },
      { key: 'reporting_poc', label: 'Reporting point of contact', type: 'text', required: false },
    ],
  },
  {
    id: 'SITUATIONAL_AWARENESS',
    name: 'Situational awareness brief',
    description: 'Periodic updates for leadership stakeholders',
    icon: Eye,
    fields: [
      { key: 'reporting_period', label: 'Reporting period', type: 'text', required: true },
      { key: 'area_of_focus', label: 'Area of focus', type: 'text', required: true },
      { key: 'current_situation', label: 'Current situation summary', type: 'textarea', required: true },
      { key: 'key_developments', label: 'Key developments', type: 'textarea', required: true },
      { key: 'outlook_forecast', label: 'Outlook / forecast', type: 'textarea', required: false },
      { key: 'recommended_actions', label: 'Recommended leadership actions', type: 'textarea', required: false },
    ],
  },
];

export function getTemplateById(id: NoticeTemplateId): NoticeTemplate {
  const tpl = NOTICE_TEMPLATES.find((t) => t.id === id);
  if (!tpl) throw new Error(`Unknown notice template: ${id}`);
  return tpl;
}

export type DistributionType = 'INTERNAL' | 'EXTERNAL' | 'RESTRICTED';
export const DISTRIBUTION_OPTIONS: Array<{ value: DistributionType; label: string }> = [
  { value: 'INTERNAL', label: 'Internal only' },
  { value: 'EXTERNAL', label: 'External' },
  { value: 'RESTRICTED', label: 'Restricted' },
];

export type Sensitivity = 'LOW' | 'MEDIUM' | 'HIGH';
export const SENSITIVITY_OPTIONS: Array<{ value: Sensitivity; label: string }> = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
];

/**
 * Serializes template field values + distribution type as a structured HTML block
 * that precedes the rich text body. Stored in NOTICES.CONTENT.
 */
export function buildNoticeContent(args: {
  templateId: NoticeTemplateId;
  distributionType: DistributionType;
  templateValues: Record<string, string>;
  body: string;
}): string {
  const tpl = getTemplateById(args.templateId);
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const rows = tpl.fields
    .map((f) => {
      const val = (args.templateValues[f.key] || '').trim();
      if (!val) return '';
      return `<dt>${escape(f.label)}</dt><dd>${escape(val).replace(/\n/g, '<br/>')}</dd>`;
    })
    .filter(Boolean)
    .join('');

  const header = `<div data-notice-template="${tpl.id}" data-distribution="${args.distributionType}">` +
    `<dl class="notice-template-fields">` +
    `<dt>Distribution</dt><dd>${escape(args.distributionType)}</dd>` +
    rows +
    `</dl></div>`;

  return header + (args.body || '');
}
