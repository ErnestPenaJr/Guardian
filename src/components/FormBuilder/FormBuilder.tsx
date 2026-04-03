import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { FormField } from '../../types/formBuilder';
import { UiFieldType } from '../../services/fieldTypeService';
import { GuardianSweetAlert } from '../../utils/sweetAlert';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface FormBuilderProps {
  initialFields: FormField[];
  fieldTypes: UiFieldType[];
  formName: string;
  formType: string;
  formDescription: string;
  onSave: (data: { name: string; description: string; type: string; fields: FormField[] }) => Promise<void>;
  onCancel: () => void;
  isEditing: boolean;
}

type View = 'editor' | 'preview' | 'code';
type LeftTab = 'elements' | 'tree';
type SubTab = 'properties' | 'data' | 'layout' | 'validation' | 'conditions';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const LAYOUT_TYPES = ['header', 'divider'];

const LAYOUT_FIELD_DEFS = [
  { type: 'header', label: 'Header', icon: 'H1' },
  { type: 'divider', label: 'Divider', icon: '—' },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function mkId(): string {
  return `fld_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function mkField(type: string, fieldTypeId?: number): FormField {
  return {
    id: mkId(),
    fieldName: type.charAt(0).toUpperCase() + type.slice(1),
    fieldType: type,
    required: false,
    options: '',
    placeholder: '',
    helpText: '',
    validation: '',
    defaultValue: '',
    sequence: 0,
    isActive: true,
    fieldTypeId: fieldTypeId ?? 0,
  };
}

/* ------------------------------------------------------------------ */
/*  Global CSS (injected once)                                         */
/* ------------------------------------------------------------------ */

const GLOBAL_CSS = `
.fb-wrap *{box-sizing:border-box}
.fb-wrap{
  --fb-accent:#3B6EF0;--fb-al:rgba(59,110,240,.08);--fb-af:rgba(59,110,240,.35);
  --fb-ag:rgba(59,110,240,.14);
  --fb-bg:#F3F5F9;--fb-panel:#fff;--fb-input:#FAFBFC;--fb-sec:#F7F8FA;
  --fb-border:#E4E6EB;--fb-t:#1A1D23;--fb-t2:#6B7280;--fb-t3:#9EA5B3;
  --fb-danger:#E53935;--fb-r:8px;
  display:flex;flex-direction:column;height:100vh;overflow:hidden;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  font-size:14px;color:var(--fb-t);background:var(--fb-bg);
}
.fb-wrap ::-webkit-scrollbar{width:5px;height:5px}
.fb-wrap ::-webkit-scrollbar-track{background:transparent}
.fb-wrap ::-webkit-scrollbar-thumb{background:var(--fb-border);border-radius:10px}
.fb-toolbar{display:flex;align-items:center;gap:8px;padding:0 16px;height:52px;background:var(--fb-panel);border-bottom:1.5px solid var(--fb-border);flex-shrink:0;z-index:20}
.fb-logo{display:flex;align-items:center;gap:8px;margin-right:8px}
.fb-logo-mark{width:28px;height:28px;border-radius:7px;background:var(--fb-accent);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px}
.fb-logo-text{font-size:14px;font-weight:600}
.fb-spacer{flex:1}
.fb-vtoggle{display:flex;background:var(--fb-sec);border-radius:var(--fb-r);padding:3px;border:1.5px solid var(--fb-border);gap:2px}
.fb-vbtn{padding:5px 14px;border-radius:6px;border:none;cursor:pointer;font-size:12px;font-weight:500;background:transparent;color:var(--fb-t2);transition:all .12s;font-family:inherit}
.fb-vbtn.active{background:#fff;color:var(--fb-t);box-shadow:0 1px 4px rgba(0,0,0,.08)}
.fb-count{font-size:12px;color:var(--fb-t3)}
.fb-badge{font-size:11px;padding:3px 8px;border-radius:20px;background:var(--fb-sec);color:var(--fb-t3);border:1px solid var(--fb-border);transition:all .3s}
.fb-badge.saved{background:#e6f9ec;color:#1a7f37;border-color:#a7f0b6}
.fb-btn{padding:6px 12px;border:1.5px solid var(--fb-border);border-radius:7px;background:none;cursor:pointer;font-size:12px;font-weight:500;color:var(--fb-t2);font-family:inherit;transition:all .12s}
.fb-btn:hover:not(:disabled){border-color:var(--fb-accent);color:var(--fb-accent)}
.fb-btn:disabled{opacity:.4;cursor:not-allowed}
.fb-btn-p{background:var(--fb-accent);border-color:var(--fb-accent);color:#fff;font-size:13px;padding:7px 18px;font-weight:600}
.fb-btn-p:hover:not(:disabled){background:#2a5ce0;border-color:#2a5ce0;color:#fff}
.fb-body{display:flex;flex:1;overflow:hidden}
.fb-left{width:248px;background:var(--fb-panel);border-right:1.5px solid var(--fb-border);display:flex;flex-direction:column;flex-shrink:0}
.fb-ptabs{display:flex;border-bottom:1.5px solid var(--fb-border)}
.fb-ptab{flex:1;padding:11px 0;border:none;background:none;cursor:pointer;font-size:12px;font-weight:500;text-transform:capitalize;color:var(--fb-t2);border-bottom:2px solid transparent;margin-bottom:-1.5px;font-family:inherit}
.fb-ptab.active{color:var(--fb-accent);border-bottom-color:var(--fb-accent)}
.fb-pbody{flex:1;overflow-y:auto}
.fb-srchwrap{padding:10px 10px 4px}
.fb-srch{width:100%;padding:7px 10px;border:1.5px solid var(--fb-border);border-radius:7px;font-size:12px;background:var(--fb-sec);color:var(--fb-t);outline:none;font-family:inherit}
.fb-srch:focus{border-color:var(--fb-accent);box-shadow:0 0 0 3px var(--fb-ag)}
.fb-hint{margin:0 10px 4px;font-size:11px;color:var(--fb-t3);line-height:1.4}
.fb-grp{padding:6px 10px 4px}
.fb-glbl{margin:0 0 5px;font-size:10px;font-weight:600;color:var(--fb-t3);letter-spacing:.08em;text-transform:uppercase}
.fb-pgrid{display:grid;grid-template-columns:1fr 1fr;gap:5px}
.fb-pitem{display:flex;align-items:center;gap:7px;padding:8px;border:1.5px solid var(--fb-border);border-radius:8px;background:var(--fb-panel);cursor:grab;user-select:none;transition:border-color .1s,background .1s}
.fb-pitem:hover{border-color:var(--fb-accent);background:var(--fb-al)}
.fb-pitem.dragging{opacity:.35;cursor:grabbing}
.fb-picon{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:6px;background:var(--fb-sec);font-size:11px;font-weight:700;color:var(--fb-accent);font-family:monospace;flex-shrink:0;pointer-events:none}
.fb-plbl{font-size:12px;font-weight:500;color:var(--fb-t);pointer-events:none}
.fb-tree{padding:10px}
.fb-titem{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:7px;cursor:pointer;margin-bottom:2px;border:1.5px solid transparent}
.fb-titem:hover{background:var(--fb-sec)}
.fb-titem.active{background:var(--fb-al);border-color:var(--fb-af)}
.fb-tnum{color:var(--fb-t3);font-size:11px;width:16px;text-align:center;flex-shrink:0}
.fb-ttype{font-size:11px;color:var(--fb-t3);font-family:monospace;flex-shrink:0}
.fb-tname{font-size:13px;color:var(--fb-t);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fb-tdot{width:6px;height:6px;border-radius:50%;background:var(--fb-danger);flex-shrink:0}
.fb-canvas{flex:1;overflow-y:auto;padding:24px 32px}
.fb-ci{max-width:660px;margin:0 auto}
.fb-titlerow{margin-bottom:20px;display:flex;align-items:center;gap:12px}
.fb-titleinp{font-size:20px;font-weight:600;color:var(--fb-t);border:none;background:none;outline:none;font-family:inherit;flex:1}
.fb-draftbadge{font-size:12px;padding:3px 10px;border-radius:20px;background:var(--fb-sec);color:var(--fb-t3);border:1.5px solid var(--fb-border);flex-shrink:0}
.fb-dl{height:4px;border-radius:2px;background:var(--fb-accent);margin:0;opacity:0;transition:opacity .12s;pointer-events:none;box-shadow:0 0 6px var(--fb-ag)}
.fb-dl.over{opacity:1}
.fb-dz{height:14px;margin:-7px 0;position:relative;z-index:4;cursor:default}
.fb-empty{min-height:200px;border-radius:12px;border:2px dashed var(--fb-border);display:flex;align-items:center;justify-content:center;text-align:center;transition:all .15s}
.fb-empty.over{border-color:var(--fb-accent);background:var(--fb-al)}
.fb-ei{font-size:32px;margin-bottom:10px;opacity:.4}
.fb-et{font-size:14px;font-weight:500;color:var(--fb-t3);margin-bottom:4px}
.fb-es{font-size:12px;color:var(--fb-t3)}
.fb-addbtn{margin-top:12px;width:100%;padding:11px;border:2px dashed var(--fb-border);border-radius:10px;background:none;cursor:pointer;color:var(--fb-t3);font-size:13px;font-weight:500;font-family:inherit}
.fb-addbtn:hover{border-color:var(--fb-accent);color:var(--fb-accent)}
.fb-card{position:relative;padding:14px 16px 14px 36px;border-radius:10px;border:2px solid var(--fb-border);background:var(--fb-panel);cursor:pointer;transition:border-color .12s,box-shadow .12s;user-select:none}
.fb-card:hover{border-color:var(--fb-af)}
.fb-card.selected{border-color:var(--fb-accent);background:#FAFBFF;box-shadow:0 0 0 3px var(--fb-ag)}
.fb-card.dragging{opacity:.3}
.fb-handle{position:absolute;left:0;top:0;bottom:0;width:30px;display:flex;align-items:center;justify-content:center;cursor:grab;color:var(--fb-t3);font-size:15px;border-radius:10px 0 0 10px;user-select:none;touch-action:none}
.fb-handle:hover{color:var(--fb-t2)}
.fb-del{position:absolute;top:8px;right:8px;background:none;border:none;cursor:pointer;color:var(--fb-t3);font-size:14px;padding:2px 6px;border-radius:5px;line-height:1;display:none;font-family:inherit}
.fb-card.selected .fb-del{display:block}
.fb-del:hover{color:var(--fb-danger);background:#fff0f0}
.fb-cmeta{display:flex;align-items:center;gap:6px;margin-bottom:7px}
.fb-ctype{font-size:10px;padding:2px 6px;border-radius:4px;background:var(--fb-sec);color:var(--fb-t3);font-family:monospace;font-weight:500}
.fb-creq{font-size:10px;color:var(--fb-danger);font-weight:700}
.fb-clbl{display:block;font-size:13px;font-weight:500;color:var(--fb-t);margin-bottom:6px}
.fb-ast{color:var(--fb-danger);margin-left:3px}
.fb-cdesc{margin:6px 0 0;font-size:12px;color:var(--fb-t3)}
.fb-fi{width:100%;padding:7px 10px;border:1.5px solid var(--fb-border);border-radius:7px;font-size:13px;color:var(--fb-t);background:var(--fb-input);outline:none;font-family:inherit;pointer-events:none}
.fb-fta{height:60px;resize:none}
.fb-fopts{display:flex;flex-direction:column;gap:6px}
.fb-fopt{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--fb-t2);pointer-events:none}
.fb-fopt input{accent-color:var(--fb-accent);flex-shrink:0;pointer-events:none}
.fb-ftog{display:flex;align-items:center;gap:10px;pointer-events:none}
.fb-ftogtrack{width:36px;height:20px;border-radius:10px;background:var(--fb-accent);display:inline-flex;align-items:center;padding:0 2px;flex-shrink:0}
.fb-ftogthumb{width:16px;height:16px;border-radius:50%;background:#fff;margin-left:auto}
.fb-fh3{font-size:17px;font-weight:600;color:var(--fb-t)}
.fb-fhr{border:none;border-top:1.5px solid var(--fb-border);margin:4px 0}
.fb-ffile{display:flex;align-items:center;gap:8px;color:var(--fb-t3);pointer-events:none}
.fb-right{width:284px;background:var(--fb-panel);border-left:1.5px solid var(--fb-border);display:flex;flex-direction:column;flex-shrink:0}
.fb-rtabs{display:flex;border-bottom:1.5px solid var(--fb-border);overflow-x:auto;flex-shrink:0}
.fb-rtab{flex:1;padding:11px 4px;border:none;background:none;cursor:pointer;font-size:11px;font-weight:500;white-space:nowrap;text-transform:capitalize;color:var(--fb-t2);border-bottom:2px solid transparent;margin-bottom:-1.5px;font-family:inherit}
.fb-rtab.active{color:var(--fb-accent);border-bottom-color:var(--fb-accent)}
.fb-rscroll{flex:1;overflow-y:auto}
.fb-rempty{padding:28px;text-align:center}
.fb-rempty-arrow{font-size:40px;opacity:.2;margin-bottom:10px}
.fb-rempty-txt{color:var(--fb-t3);font-size:13px}
.fb-stabs{display:flex;border-bottom:1.5px solid var(--fb-border);margin-bottom:14px;overflow-x:auto}
.fb-stab{padding:8px 9px;border:none;background:none;cursor:pointer;font-size:11px;font-weight:500;white-space:nowrap;text-transform:capitalize;color:var(--fb-t2);border-bottom:2px solid transparent;margin-bottom:-1.5px;font-family:inherit}
.fb-stab.active{color:var(--fb-accent);border-bottom-color:var(--fb-accent)}
.fb-pform{padding:16px}
.fb-prow{margin-bottom:14px}
.fb-plbl2{display:block;font-size:12px;font-weight:500;color:var(--fb-t2);margin-bottom:5px}
.fb-pinp{width:100%;padding:7px 10px;border:1.5px solid var(--fb-border);border-radius:7px;font-size:13px;color:var(--fb-t);background:var(--fb-input);outline:none;font-family:inherit}
.fb-pinp:focus{border-color:var(--fb-accent);box-shadow:0 0 0 3px var(--fb-ag)}
.fb-mono{font-family:monospace;font-size:12px}
.fb-togrow{display:flex;align-items:center;gap:8px;cursor:pointer}
.fb-togwrap{position:relative;width:36px;height:20px;flex-shrink:0}
.fb-togwrap input{opacity:0;position:absolute;inset:0;cursor:pointer;margin:0;width:100%;height:100%}
.fb-togbg{width:100%;height:100%;border-radius:10px;background:var(--fb-border);transition:background .2s;pointer-events:none}
.fb-togwrap input:checked~.fb-togbg{background:var(--fb-accent)}
.fb-togknob{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .2s;pointer-events:none;box-shadow:0 1px 3px rgba(0,0,0,.2)}
.fb-togwrap input:checked~.fb-togknob{left:18px}
.fb-toglbl{font-size:13px;color:var(--fb-t)}
.fb-segs{display:flex;gap:6px}
.fb-seg{flex:1;padding:7px 0;border:1.5px solid var(--fb-border);border-radius:7px;background:none;cursor:pointer;font-size:12px;font-weight:500;color:var(--fb-t2);font-family:inherit}
.fb-seg.active{border-color:var(--fb-accent);background:var(--fb-al);color:var(--fb-accent)}
.fb-optlist{display:flex;flex-direction:column;gap:6px;margin-bottom:8px}
.fb-optrow{display:flex;gap:5px;align-items:center}
.fb-optrow .fb-pinp{flex:1}
.fb-delopt{background:none;border:none;cursor:pointer;color:var(--fb-t3);font-size:14px;padding:0 4px;font-family:inherit;flex-shrink:0}
.fb-delopt:hover{color:var(--fb-danger)}
.fb-addopt{width:100%;padding:7px;border:1.5px dashed var(--fb-border);border-radius:7px;background:none;cursor:pointer;color:var(--fb-accent);font-size:12px;font-weight:500;font-family:inherit}
.fb-valrule{display:flex;align-items:center;gap:8px;margin-bottom:10px;cursor:pointer;font-size:13px;font-family:monospace;color:var(--fb-t)}
.fb-valrule input{accent-color:var(--fb-accent);width:14px;height:14px;cursor:pointer}
.fb-stubbtn{width:100%;padding:10px;border:1.5px dashed var(--fb-border);border-radius:8px;background:none;cursor:pointer;color:var(--fb-accent);font-size:13px;font-weight:500;font-family:inherit}
.fb-muted{font-size:12px;color:var(--fb-t3);text-align:center;margin-top:16px}
.fb-tpanel,.fb-epanel,.fb-mpanel{padding:16px}
.fb-swatches{display:flex;gap:8px;flex-wrap:wrap}
.fb-swatch{width:28px;height:28px;border-radius:7px;border:2px solid transparent;cursor:pointer}
.fb-swatch:hover{transform:scale(1.12)}
.fb-swatch.active{box-shadow:0 0 0 3px #fff,0 0 0 5px var(--fb-accent)}
.fb-enote{font-size:13px;color:var(--fb-t2);margin-bottom:12px}
.fb-copybtn{width:100%;padding:10px;background:var(--fb-accent);border:none;border-radius:8px;color:#fff;font-weight:600;font-size:13px;cursor:pointer;font-family:inherit}
.fb-copybtn:hover{background:#2a5ce0}
.fb-mjson{margin:0;font-size:11px;line-height:1.7;color:var(--fb-t2);background:var(--fb-sec);padding:14px;border-radius:8px;overflow-x:auto;font-family:monospace;white-space:pre-wrap}
.fb-preview{flex:1;overflow-y:auto;padding:32px 24px}
.fb-pcard{max-width:560px;margin:0 auto;background:var(--fb-panel);border-radius:14px;border:1.5px solid var(--fb-border);padding:32px;box-shadow:0 4px 24px rgba(0,0,0,.06)}
.fb-prvform{display:flex;flex-direction:column;gap:20px}
.fb-pgrp{display:flex;flex-direction:column;gap:6px}
.fb-pfl{font-size:14px;font-weight:500;color:var(--fb-t)}
.fb-pfl .fb-ast{color:var(--fb-danger);margin-left:3px}
.fb-pfinp{width:100%;padding:9px 12px;border:1.5px solid var(--fb-border);border-radius:8px;font-size:14px;color:var(--fb-t);background:var(--fb-input);outline:none;font-family:inherit}
.fb-pfinp:focus{border-color:var(--fb-accent);box-shadow:0 0 0 3px var(--fb-ag)}
.fb-pfhelp{font-size:12px;color:var(--fb-t3)}
.fb-pfsub{padding:11px 24px;background:var(--fb-accent);border:none;border-radius:8px;color:#fff;font-size:14px;font-weight:600;cursor:pointer;align-self:flex-start;font-family:inherit}
.fb-pfempty{text-align:center;color:var(--fb-t3);padding:40px 0}
.fb-code{flex:1;overflow-y:auto;padding:24px}
.fb-ccard{max-width:720px;margin:0 auto;background:var(--fb-panel);border-radius:12px;border:1.5px solid var(--fb-border);overflow:hidden}
.fb-chdr{padding:12px 16px;border-bottom:1.5px solid var(--fb-border);display:flex;align-items:center;justify-content:space-between}
.fb-ctitle{font-size:12px;font-weight:500;color:var(--fb-t2)}
.fb-cjson{margin:0;padding:20px;font-size:12px;line-height:1.7;color:var(--fb-t2);font-family:monospace;white-space:pre-wrap;overflow-x:auto}
`;

/* ------------------------------------------------------------------ */
/*  Group field types into palette categories                          */
/* ------------------------------------------------------------------ */

const iconMap: Record<string, string> = {
  text_input: 'T', text: 'T', textarea: '¶', number: '#', email: '@', phone: '☎',
  dropdown: '▾', select: '▾', radio: '◎', checkbox: '✓', checkboxes: '✓',
  date: '▦', time: '◷', datetime: '▦◷', date_time: '▦◷',
  file: '↑', file_upload: '↑', image: '▣',
  ssn: '***', dob: '▦', account_number: '#', address: '⌂',
};

interface PaletteGroup {
  label: string;
  items: { type: string; label: string; icon: string; dbFieldTypeId?: number }[];
}

function groupFieldTypes(dbTypes: UiFieldType[]): PaletteGroup[] {
  const basic = ['text_input', 'text', 'textarea', 'number', 'email', 'phone'];
  const selection = ['dropdown', 'select', 'radio', 'checkbox', 'checkboxes'];
  const dateTime = ['date', 'time', 'datetime', 'date_time'];
  const fileTypes = ['file', 'file_upload'];

  const groups: PaletteGroup[] = [
    { label: 'Basic', items: [] },
    { label: 'Selection', items: [] },
    { label: 'Date & Time', items: [] },
    { label: 'Specialized', items: [] },
    { label: 'File', items: [] },
    { label: 'Layout', items: LAYOUT_FIELD_DEFS.map((d) => ({ ...d, dbFieldTypeId: undefined })) },
  ];

  for (const ft of dbTypes) {
    const entry = { type: ft.type, label: ft.label, icon: iconMap[ft.type] || ft.icon || '?', dbFieldTypeId: ft.dbFieldTypeId };
    if (basic.includes(ft.type)) groups[0].items.push(entry);
    else if (selection.includes(ft.type)) groups[1].items.push(entry);
    else if (dateTime.includes(ft.type)) groups[2].items.push(entry);
    else if (fileTypes.includes(ft.type)) groups[3].items.push(entry); // intentionally file bucket, index 4
    else groups[3].items.push(entry); // specialized
  }
  // fix: file bucket is index 4
  // Re-sort file items into the correct bucket – the loop above puts file types in index 3 (specialized)
  // Let's redo cleanly:
  groups[0].items = [];
  groups[1].items = [];
  groups[2].items = [];
  groups[3].items = [];
  groups[4].items = [];

  for (const ft of dbTypes) {
    const entry = { type: ft.type, label: ft.label, icon: iconMap[ft.type] || ft.icon || '?', dbFieldTypeId: ft.dbFieldTypeId };
    if (basic.includes(ft.type)) groups[0].items.push(entry);
    else if (selection.includes(ft.type)) groups[1].items.push(entry);
    else if (dateTime.includes(ft.type)) groups[2].items.push(entry);
    else if (fileTypes.includes(ft.type)) groups[4].items.push(entry);
    else groups[3].items.push(entry);
  }

  return groups.filter((g) => g.items.length > 0);
}

/* ------------------------------------------------------------------ */
/*  PropsPanel — right panel properties editor                         */
/* ------------------------------------------------------------------ */

const VALIDATION_RULES = ['required', 'min', 'max', 'email', 'url', 'regex', 'numeric', 'alpha'];
const OPTION_FIELD_TYPES = ['dropdown', 'select', 'radio', 'checkbox', 'checkboxes'];

function PropsPanel({
  field,
  subTab,
  setSubTab,
  onChange,
}: {
  field: FormField;
  subTab: SubTab;
  setSubTab: (t: SubTab) => void;
  onChange: (f: FormField) => void;
}) {
  const opts = (field.options || '').split(',').map((o) => o.trim()).filter(Boolean);
  const valRules = (field.validation || '').split(',').map((v) => v.trim()).filter(Boolean);

  const toggleValidation = (rule: string) => {
    const next = valRules.includes(rule) ? valRules.filter((r) => r !== rule) : [...valRules, rule];
    onChange({ ...field, validation: next.join(',') });
  };

  return (
    <>
      <div className="fb-stabs">
        {(['properties', 'data', 'layout', 'validation', 'conditions'] as SubTab[]).map((t) => (
          <button
            key={t}
            className={`fb-stab ${subTab === t ? 'active' : ''}`}
            onClick={() => setSubTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="fb-pform">
        {subTab === 'properties' && (
          <>
            <div className="fb-prow">
              <label className="fb-plbl2">Label</label>
              <input
                className="fb-pinp"
                value={field.fieldName}
                onChange={(e) => onChange({ ...field, fieldName: e.target.value })}
              />
            </div>
            <div className="fb-prow">
              <label className="fb-plbl2">Placeholder</label>
              <input
                className="fb-pinp"
                value={field.placeholder || ''}
                onChange={(e) => onChange({ ...field, placeholder: e.target.value })}
              />
            </div>
            <div className="fb-prow">
              <label className="fb-plbl2">Help text</label>
              <input
                className="fb-pinp"
                value={field.helpText || ''}
                onChange={(e) => onChange({ ...field, helpText: e.target.value })}
              />
            </div>
            <div className="fb-prow">
              <label className="fb-togrow">
                <span className="fb-togwrap">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) => onChange({ ...field, required: e.target.checked })}
                  />
                  <span className="fb-togbg" />
                  <span className="fb-togknob" />
                </span>
                <span className="fb-toglbl">Required</span>
              </label>
            </div>
          </>
        )}

        {subTab === 'data' && (
          <>
            {OPTION_FIELD_TYPES.includes(field.fieldType) ? (
              <>
                <label className="fb-plbl2">Options</label>
                <div className="fb-optlist">
                  {opts.map((o, i) => (
                    <div key={i} className="fb-optrow">
                      <input
                        className="fb-pinp"
                        value={o}
                        onChange={(e) => {
                          const next = [...opts];
                          next[i] = e.target.value;
                          onChange({ ...field, options: next.join(',') });
                        }}
                      />
                      <button
                        className="fb-delopt"
                        onClick={() => {
                          const next = opts.filter((_, idx) => idx !== i);
                          onChange({ ...field, options: next.join(',') });
                        }}
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  className="fb-addopt"
                  onClick={() => onChange({ ...field, options: [...opts, `Option ${opts.length + 1}`].join(',') })}
                >
                  + Add option
                </button>
              </>
            ) : (
              <p style={{ color: 'var(--fb-t3)', fontSize: 13, textAlign: 'center', marginTop: 16 }}>
                Options are not applicable for this field type.
              </p>
            )}
          </>
        )}

        {subTab === 'layout' && (
          <>
            <div className="fb-prow">
              <label className="fb-plbl2">Size</label>
              <div className="fb-segs">
                {['SM', 'MD', 'LG'].map((s) => (
                  <button key={s} className={`fb-seg ${s === 'MD' ? 'active' : ''}`}>{s}</button>
                ))}
              </div>
            </div>
            <div className="fb-prow">
              <label className="fb-plbl2">Column span</label>
              <div className="fb-segs">
                {['1/3', '2/3', 'Full'].map((s) => (
                  <button key={s} className={`fb-seg ${s === 'Full' ? 'active' : ''}`}>{s}</button>
                ))}
              </div>
            </div>
          </>
        )}

        {subTab === 'validation' && (
          <>
            {VALIDATION_RULES.map((rule) => (
              <label key={rule} className="fb-valrule">
                <input
                  type="checkbox"
                  checked={valRules.includes(rule)}
                  onChange={() => toggleValidation(rule)}
                />
                {rule}
              </label>
            ))}
          </>
        )}

        {subTab === 'conditions' && (
          <>
            <button className="fb-stubbtn">+ Add condition</button>
            <p className="fb-muted">No conditions</p>
          </>
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  FieldPreview — inline preview of each field type on canvas cards    */
/* ------------------------------------------------------------------ */

function FieldPreview({ field }: { field: FormField }) {
  const opts = (field.options || '').split(',').map((o) => o.trim()).filter(Boolean);

  switch (field.fieldType) {
    case 'textarea':
      return <textarea className="fb-fi fb-fta" placeholder={field.placeholder || ''} readOnly />;
    case 'dropdown':
    case 'select':
      return (
        <select className="fb-fi" disabled>
          <option>{field.placeholder || 'Select...'}</option>
          {opts.map((o) => <option key={o}>{o}</option>)}
        </select>
      );
    case 'checkbox':
    case 'checkboxes':
      return (
        <div className="fb-fopts">
          {(opts.length > 0 ? opts : ['Option 1']).map((o) => (
            <label key={o} className="fb-fopt"><input type="checkbox" readOnly />{o}</label>
          ))}
        </div>
      );
    case 'radio':
      return (
        <div className="fb-fopts">
          {(opts.length > 0 ? opts : ['Option 1']).map((o) => (
            <label key={o} className="fb-fopt"><input type="radio" name={field.id} readOnly />{o}</label>
          ))}
        </div>
      );
    case 'header':
      return <div className="fb-fh3">{field.fieldName}</div>;
    case 'divider':
      return <hr className="fb-fhr" />;
    case 'file':
    case 'file_upload':
      return <div className="fb-ffile">↑ Upload file</div>;
    case 'date':
      return <input className="fb-fi" type="date" readOnly />;
    case 'time':
      return <input className="fb-fi" type="time" readOnly />;
    case 'datetime':
    case 'date_time':
      return <input className="fb-fi" type="datetime-local" readOnly />;
    default:
      return <input className="fb-fi" type="text" placeholder={field.placeholder || ''} readOnly />;
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function FormBuilder({
  initialFields,
  fieldTypes,
  formName,
  formType: formTypeProp,
  formDescription,
  onSave,
  onCancel,
  isEditing,
}: FormBuilderProps) {
  /* -- state -- */
  const [fields, setFields] = useState<FormField[]>(initialFields);
  const [name, setName] = useState(formName);
  const [description, setDescription] = useState(formDescription);
  const [formType, setFormType] = useState(formTypeProp);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<View>('editor');
  const [leftTab, setLeftTab] = useState<LeftTab>('elements');
  const [subTab, setSubTab] = useState<SubTab>('properties');
  const [search, setSearch] = useState('');
  const [history, setHistory] = useState<FormField[][]>([]);
  const [saving, setSaving] = useState(false);
  const [formStatus, setFormStatus] = useState<'draft' | 'saved'>('draft');
  const [dropOver, setDropOver] = useState<number | null>(null);
  const [accentColor, setAccentColor] = useState('#3B6EF0');

  const drag = useRef<{ type: 'palette' | 'canvas' | null; payload: string | null }>({
    type: null,
    payload: null,
  });

  /* -- inject CSS -- */
  useEffect(() => {
    const id = 'fb-global-css';
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      style.textContent = GLOBAL_CSS;
      document.head.appendChild(style);
    }
    return () => {
      const el = document.getElementById(id);
      if (el) el.remove();
    };
  }, []);

  /* -- helpers -- */
  const pushHistory = useCallback((snapshot: FormField[]) => {
    setHistory((prev) => {
      const next = [...prev, JSON.parse(JSON.stringify(snapshot)) as FormField[]];
      if (next.length > 30) next.shift();
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const last = next.pop()!;
      setFields(last);
      setSelectedId(null);
      return next;
    });
  }, []);

  const handleClear = useCallback(async () => {
    const confirmed = await GuardianSweetAlert.showConfirmation(
      'Clear all fields?',
      'This will remove every field from the canvas. You can undo this action.',
      { confirmText: 'Clear', dangerousAction: true },
    );
    if (!confirmed) return;
    pushHistory(fields);
    setFields([]);
    setSelectedId(null);
  }, [fields, pushHistory]);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      toast.error('Please enter a form name');
      return;
    }
    setSaving(true);
    try {
      await onSave({ name, description, type: formType, fields });
      setFormStatus('saved');
      toast.success('Form saved successfully');
      setTimeout(() => setFormStatus('draft'), 3000);
    } catch {
      toast.error('Failed to save form');
    } finally {
      setSaving(false);
    }
  }, [name, description, formType, fields, onSave]);

  /* -- field CRUD -- */
  const addField = useCallback((type: string, dbFieldTypeId?: number) => {
    pushHistory(fields);
    const f = mkField(type, dbFieldTypeId);
    f.sequence = fields.length;
    setFields((prev) => [...prev, f]);
    setSelectedId(f.id);
  }, [fields, pushHistory]);

  const updateField = useCallback((updated: FormField) => {
    pushHistory(fields);
    setFields((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
  }, [fields, pushHistory]);

  const deleteField = useCallback((id: string) => {
    pushHistory(fields);
    setFields((prev) => prev.filter((f) => f.id !== id));
    setSelectedId((prev) => (prev === id ? null : prev));
  }, [fields, pushHistory]);

  /* -- palette groups -- */
  const paletteGroups = groupFieldTypes(fieldTypes);

  /* -- drag-and-drop -- */
  const handleDrop = useCallback((insertAt: number) => {
    setDropOver(null);
    const d = drag.current;
    if (!d.type || !d.payload) return;

    if (d.type === 'palette') {
      // New field from palette
      const match = fieldTypes.find((ft) => ft.type === d.payload);
      const layoutMatch = LAYOUT_FIELD_DEFS.find((ld) => ld.type === d.payload);
      const f = mkField(d.payload, match?.dbFieldTypeId);
      if (layoutMatch) f.fieldName = layoutMatch.label;
      pushHistory(fields);
      const next = [...fields];
      next.splice(insertAt, 0, f);
      next.forEach((fld, i) => { fld.sequence = i; });
      setFields(next);
      setSelectedId(f.id);
    } else if (d.type === 'canvas') {
      // Reorder existing field
      const fromIdx = fields.findIndex((f) => f.id === d.payload);
      if (fromIdx === -1) return;
      pushHistory(fields);
      const next = [...fields];
      const [moved] = next.splice(fromIdx, 1);
      const adjustedIdx = insertAt > fromIdx ? insertAt - 1 : insertAt;
      next.splice(adjustedIdx, 0, moved);
      next.forEach((fld, i) => { fld.sequence = i; });
      setFields(next);
    }

    drag.current = { type: null, payload: null };
  }, [fields, fieldTypes, pushHistory]);

  /* -- derived -- */
  const fieldCount = fields.filter((f) => !LAYOUT_TYPES.includes(f.fieldType)).length;

  /* -- render -- */
  return (
    <div className="fb-wrap">
      {/* ---- Toolbar ---- */}
      <div className="fb-toolbar">
        <div className="fb-logo">
          <div className="fb-logo-mark">FB</div>
          <span className="fb-logo-text">Form Builder</span>
        </div>

        <input
          className="fb-titleinp"
          value={name}
          onChange={(e) => { setName(e.target.value); setFormStatus('draft'); }}
          placeholder="Untitled form"
          style={{ maxWidth: 220 }}
        />

        <span className={`fb-badge ${formStatus === 'saved' ? 'saved' : ''}`}>
          {formStatus === 'saved' ? 'Saved' : 'Draft'}
        </span>

        <div className="fb-spacer" />

        <span className="fb-count">{fieldCount} field{fieldCount !== 1 ? 's' : ''}</span>

        <div className="fb-vtoggle">
          {(['editor', 'preview', 'code'] as View[]).map((v) => (
            <button
              key={v}
              className={`fb-vbtn ${view === v ? 'active' : ''}`}
              onClick={() => setView(v)}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>

        <button className="fb-btn" disabled={history.length === 0} onClick={undo}>
          Undo
        </button>
        <button className="fb-btn" disabled={fields.length === 0} onClick={handleClear}>
          Clear
        </button>
        <button className="fb-btn" onClick={onCancel}>
          Cancel
        </button>
        <button className="fb-btn fb-btn-p" disabled={saving} onClick={handleSave}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* ---- Body ---- */}
      <div className="fb-body">
        {/* Left panel */}
        {view === 'editor' && (
          <div className="fb-left">
            <div className="fb-ptabs">
              {(['elements', 'tree'] as LeftTab[]).map((t) => (
                <button
                  key={t}
                  className={`fb-ptab ${leftTab === t ? 'active' : ''}`}
                  onClick={() => setLeftTab(t)}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="fb-pbody">
              {leftTab === 'elements' ? (
                <>
                  <div className="fb-srchwrap">
                    <input
                      className="fb-srch"
                      placeholder="Search fields..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <p className="fb-hint">Drag or click to add fields</p>
                  {paletteGroups.map((g) => {
                    const filtered = g.items.filter(
                      (it) =>
                        !search ||
                        it.label.toLowerCase().includes(search.toLowerCase()) ||
                        it.type.toLowerCase().includes(search.toLowerCase()),
                    );
                    if (filtered.length === 0) return null;
                    return (
                      <div className="fb-grp" key={g.label}>
                        <p className="fb-glbl">{g.label}</p>
                        <div className="fb-pgrid">
                          {filtered.map((it) => (
                            <div
                              key={it.type}
                              className="fb-pitem"
                              draggable
                              onDragStart={(e) => {
                                drag.current = { type: 'palette', payload: it.type };
                                e.dataTransfer.setData('text/plain', it.type);
                                (e.currentTarget as HTMLElement).classList.add('dragging');
                              }}
                              onDragEnd={(e) => {
                                (e.currentTarget as HTMLElement).classList.remove('dragging');
                                drag.current = { type: null, payload: null };
                              }}
                              onClick={() => addField(it.type, it.dbFieldTypeId)}
                            >
                              <span className="fb-picon">{iconMap[it.type] || it.icon || '?'}</span>
                              <span className="fb-plbl">{it.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : (
                <div className="fb-tree">
                  {fields.length === 0 && (
                    <p style={{ textAlign: 'center', color: 'var(--fb-t3)', fontSize: 13 }}>
                      No fields yet
                    </p>
                  )}
                  {fields.map((f, i) => (
                    <div
                      key={f.id}
                      className={`fb-titem ${selectedId === f.id ? 'active' : ''}`}
                      onClick={() => setSelectedId(f.id)}
                    >
                      <span className="fb-tnum">{i + 1}</span>
                      <span className="fb-ttype">{f.fieldType}</span>
                      <span className="fb-tname">{f.fieldName}</span>
                      {f.required && <span className="fb-tdot" />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Canvas */}
        {view === 'editor' && (
          <div className="fb-canvas">
            <div className="fb-ci">
              {/* Title row */}
              <div className="fb-titlerow">
                <input
                  className="fb-titleinp"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setFormStatus('draft'); }}
                  placeholder="Untitled form"
                />
                <span className="fb-draftbadge">{isEditing ? 'Editing' : 'New'}</span>
              </div>

              {/* Description */}
              <div style={{ marginBottom: 20 }}>
                <input
                  className="fb-fi"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Form description (optional)"
                />
              </div>

              {/* Empty state */}
              {fields.length === 0 ? (
                <div
                  className={`fb-empty ${dropOver === 0 ? 'over' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropOver(0); }}
                  onDragLeave={() => setDropOver(null)}
                  onDrop={() => handleDrop(0)}
                >
                  <div>
                    <div className="fb-ei">+</div>
                    <div className="fb-et">Drop fields here</div>
                    <div className="fb-es">Drag from the left panel or click to add</div>
                  </div>
                </div>
              ) : (
                <>
                  {/* DropZone(0) */}
                  <div
                    className="fb-dz"
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropOver(0); }}
                    onDragLeave={() => setDropOver(null)}
                    onDrop={() => handleDrop(0)}
                  >
                    <div className={`fb-dl ${dropOver === 0 ? 'over' : ''}`} />
                  </div>

                  {fields.map((f, i) => (
                    <div key={f.id}>
                      {/* Card */}
                      <div
                        className={`fb-card ${selectedId === f.id ? 'selected' : ''}`}
                        draggable
                        onClick={() => setSelectedId(f.id)}
                        onDragStart={(e) => {
                          drag.current = { type: 'canvas', payload: f.id };
                          e.dataTransfer.setData('text/plain', f.id);
                          (e.currentTarget as HTMLElement).classList.add('dragging');
                        }}
                        onDragEnd={(e) => {
                          (e.currentTarget as HTMLElement).classList.remove('dragging');
                          drag.current = { type: null, payload: null };
                          setDropOver(null);
                        }}
                      >
                        <div className="fb-handle">&#x2807;</div>
                        <button className="fb-del" onClick={(e) => { e.stopPropagation(); deleteField(f.id); }}>
                          &times;
                        </button>
                        <div className="fb-cmeta">
                          <span className="fb-ctype">{f.fieldType}</span>
                          {f.required && <span className="fb-creq">Required</span>}
                        </div>
                        <span className="fb-clbl">
                          {f.fieldName}
                          {f.required && <span className="fb-ast">*</span>}
                        </span>
                        <FieldPreview field={f} />
                        {f.helpText && <p className="fb-cdesc">{f.helpText}</p>}
                      </div>

                      {/* DropZone(i+1) */}
                      <div
                        className="fb-dz"
                        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropOver(i + 1); }}
                        onDragLeave={() => setDropOver(null)}
                        onDrop={() => handleDrop(i + 1)}
                      >
                        <div className={`fb-dl ${dropOver === i + 1 ? 'over' : ''}`} />
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Add field button */}
              <button
                className="fb-addbtn"
                onClick={() => addField('text_input', fieldTypes.find((ft) => ft.type === 'text_input')?.dbFieldTypeId)}
              >
                + Add field
              </button>
            </div>
          </div>
        )}

        {/* Right panel */}
        {view === 'editor' && (
          <div className="fb-right">
            <div className="fb-rscroll">
              {selectedId && fields.find((f) => f.id === selectedId) ? (
                <PropsPanel
                  field={fields.find((f) => f.id === selectedId)!}
                  subTab={subTab}
                  setSubTab={setSubTab}
                  onChange={updateField}
                />
              ) : (
                <div className="fb-rempty">
                  <div className="fb-rempty-arrow">&larr;</div>
                  <p className="fb-rempty-txt">Select a field to edit its properties</p>
                </div>
              )}
            </div>

            {/* Theme section */}
            <div className="fb-tpanel" style={{ borderTop: '1.5px solid var(--fb-border)' }}>
              <label className="fb-plbl2">Accent color</label>
              <div className="fb-swatches">
                {['#3B6EF0', '#E53935', '#43A047', '#FB8C00', '#8E24AA', '#00ACC1'].map((c) => (
                  <button
                    key={c}
                    className={`fb-swatch ${accentColor === c ? 'active' : ''}`}
                    style={{ background: c }}
                    onClick={() => {
                      setAccentColor(c);
                      document.querySelector<HTMLElement>('.fb-wrap')?.style.setProperty('--fb-accent', c);
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
