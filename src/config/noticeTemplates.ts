/**
 * Notice modal option sets + content serializer.
 *
 * The hardcoded NOTICE_TEMPLATES list is deprecated: templates now come from
 * /api/custom-templates?type=notice&status=active (see customTemplateService).
 * Only the select options and the HTML content serializer live here now.
 */

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
 * Serializes template field values + distribution type as a structured HTML
 * block that precedes the rich-text body. Stored in NOTICES.CONTENT.
 */
export function buildNoticeContent(args: {
  templateId: string;
  distributionType: DistributionType;
  templateValues: Record<string, string>;
  body: string;
}): string {
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const rows = Object.entries(args.templateValues)
    .filter(([, v]) => (v || '').trim().length > 0)
    .map(
      ([label, val]) =>
        `<dt>${escape(label)}</dt><dd>${escape(val).replace(/\n/g, '<br/>')}</dd>`,
    )
    .join('');

  const header =
    `<div data-notice-template="${escape(args.templateId)}" data-distribution="${escape(args.distributionType)}">` +
    `<dl class="notice-template-fields">` +
    `<dt>Distribution</dt><dd>${escape(args.distributionType)}</dd>` +
    rows +
    `</dl></div>`;

  return header + (args.body || '');
}
