# Form Builder Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-page three-panel drag-and-drop form builder at `/form-builder`, wired to the existing database-backed field storage, and simplify the CustomWorkflowTemplateModal to navigate to it instead of embedding SimpleFormBuilder.

**Architecture:** A new `FormBuilderPage` wrapper handles routing, data loading, and persistence via existing `formService`. A new `FormBuilder` component renders the three-panel UI with native HTML5 DnD. The `CustomWorkflowTemplateModal` is simplified to remove its embedded field builder and navigate to the new page instead.

**Tech Stack:** React 18, TypeScript, React Router DOM v7, Native HTML5 Drag and Drop API, existing `formService` + `fieldTypeService`, `GuardianSweetAlert`, `react-toastify`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/components/FormBuilder/FormBuilder.tsx` | Create | Three-panel form builder UI component |
| `src/components/FormBuilder/index.ts` | Create | Barrel export |
| `src/pages/FormBuilderPage.tsx` | Create | Page wrapper: routing, data loading, save logic |
| `src/App.tsx` | Modify (lines 37, 84) | Add import + two routes |
| `src/components/CustomWorkflowTemplateModal.tsx` | Modify | Remove field builder, add `useNavigate`, navigate on edit/create |

---

### Task 1: Barrel Export

**Files:**
- Create: `src/components/FormBuilder/index.ts`

- [ ] **Step 1: Create the barrel export file**

```ts
export { default } from './FormBuilder';
```

- [ ] **Step 2: Commit**

```bash
git add src/components/FormBuilder/index.ts
git commit -m "chore: add FormBuilder barrel export"
```

---

### Task 2: FormBuilder Component — Skeleton + Toolbar

**Files:**
- Create: `src/components/FormBuilder/FormBuilder.tsx`

This task creates the component shell with types, state, toolbar, and the three-view toggle. No panels yet — just the outer frame.

- [ ] **Step 1: Create FormBuilder.tsx with types, state, and toolbar**

```tsx
import { useState, useRef, useCallback, useEffect } from 'react';
import { FormField } from '../../types/formBuilder';
import { UiFieldType } from '../../services/fieldTypeService';
import { GuardianSweetAlert } from '../../utils/sweetAlert';
import { toast } from 'react-toastify';

/* ─── Types ──────────────────────────────────────────────── */
interface FormBuilderProps {
  initialFields: FormField[];
  fieldTypes: UiFieldType[];
  formName: string;
  formType: string;
  formDescription: string;
  onSave: (data: {
    name: string;
    description: string;
    type: string;
    fields: FormField[];
  }) => Promise<void>;
  onCancel: () => void;
  isEditing: boolean;
}

type View = 'editor' | 'preview' | 'code';
type LeftTab = 'elements' | 'tree';
type SubTab = 'properties' | 'data' | 'layout' | 'validation' | 'conditions';

/* ─── Layout field types (client-side only, not saved to DB) ── */
const LAYOUT_TYPES = ['header', 'divider'];

const LAYOUT_FIELD_DEFS = [
  { type: 'header', label: 'Header', icon: 'H1' },
  { type: 'divider', label: 'Divider', icon: '—' },
];

/* ─── Helpers ────────────────────────────────────────────── */
const mkId = () =>
  `fld_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;

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
    fieldTypeId: fieldTypeId,
  };
}
```

Put the full CSS string as a constant (we'll use the `fb-` prefixed classes from the spec). This goes right after the helpers:

```tsx
/* ─── CSS (injected once, fb- prefixed) ──────────────────── */
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

  /* toolbar */
  .fb-toolbar{display:flex;align-items:center;gap:8px;padding:0 16px;height:52px;
    background:var(--fb-panel);border-bottom:1.5px solid var(--fb-border);flex-shrink:0;z-index:20}
  .fb-logo{display:flex;align-items:center;gap:8px;margin-right:8px}
  .fb-logo-mark{width:28px;height:28px;border-radius:7px;background:var(--fb-accent);
    display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px}
  .fb-logo-text{font-size:14px;font-weight:600}
  .fb-spacer{flex:1}
  .fb-vtoggle{display:flex;background:var(--fb-sec);border-radius:var(--fb-r);
    padding:3px;border:1.5px solid var(--fb-border);gap:2px}
  .fb-vbtn{padding:5px 14px;border-radius:6px;border:none;cursor:pointer;font-size:12px;
    font-weight:500;background:transparent;color:var(--fb-t2);transition:all .12s;font-family:inherit}
  .fb-vbtn.active{background:#fff;color:var(--fb-t);box-shadow:0 1px 4px rgba(0,0,0,.08)}
  .fb-count{font-size:12px;color:var(--fb-t3)}
  .fb-badge{font-size:11px;padding:3px 8px;border-radius:20px;background:var(--fb-sec);
    color:var(--fb-t3);border:1px solid var(--fb-border);transition:all .3s}
  .fb-badge.saved{background:#e6f9ec;color:#1a7f37;border-color:#a7f0b6}
  .fb-btn{padding:6px 12px;border:1.5px solid var(--fb-border);border-radius:7px;
    background:none;cursor:pointer;font-size:12px;font-weight:500;color:var(--fb-t2);
    font-family:inherit;transition:all .12s}
  .fb-btn:hover:not(:disabled){border-color:var(--fb-accent);color:var(--fb-accent)}
  .fb-btn:disabled{opacity:.4;cursor:not-allowed}
  .fb-btn-p{background:var(--fb-accent);border-color:var(--fb-accent);color:#fff;
    font-size:13px;padding:7px 18px;font-weight:600}
  .fb-btn-p:hover:not(:disabled){background:#2a5ce0;border-color:#2a5ce0;color:#fff}

  /* body */
  .fb-body{display:flex;flex:1;overflow:hidden}

  /* left panel */
  .fb-left{width:248px;background:var(--fb-panel);border-right:1.5px solid var(--fb-border);
    display:flex;flex-direction:column;flex-shrink:0}
  .fb-ptabs{display:flex;border-bottom:1.5px solid var(--fb-border)}
  .fb-ptab{flex:1;padding:11px 0;border:none;background:none;cursor:pointer;font-size:12px;
    font-weight:500;text-transform:capitalize;color:var(--fb-t2);
    border-bottom:2px solid transparent;margin-bottom:-1.5px;font-family:inherit}
  .fb-ptab.active{color:var(--fb-accent);border-bottom-color:var(--fb-accent)}
  .fb-pbody{flex:1;overflow-y:auto}
  .fb-srchwrap{padding:10px 10px 4px}
  .fb-srch{width:100%;padding:7px 10px;border:1.5px solid var(--fb-border);border-radius:7px;
    font-size:12px;background:var(--fb-sec);color:var(--fb-t);outline:none;font-family:inherit}
  .fb-srch:focus{border-color:var(--fb-accent);box-shadow:0 0 0 3px var(--fb-ag)}
  .fb-hint{margin:0 10px 4px;font-size:11px;color:var(--fb-t3);line-height:1.4}
  .fb-grp{padding:6px 10px 4px}
  .fb-glbl{margin:0 0 5px;font-size:10px;font-weight:600;color:var(--fb-t3);
    letter-spacing:.08em;text-transform:uppercase}
  .fb-pgrid{display:grid;grid-template-columns:1fr 1fr;gap:5px}
  .fb-pitem{display:flex;align-items:center;gap:7px;padding:8px;
    border:1.5px solid var(--fb-border);border-radius:8px;background:var(--fb-panel);
    cursor:grab;user-select:none;transition:border-color .1s,background .1s}
  .fb-pitem:hover{border-color:var(--fb-accent);background:var(--fb-al)}
  .fb-pitem.dragging{opacity:.35;cursor:grabbing}
  .fb-picon{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;
    border-radius:6px;background:var(--fb-sec);font-size:11px;font-weight:700;
    color:var(--fb-accent);font-family:monospace;flex-shrink:0;pointer-events:none}
  .fb-plbl{font-size:12px;font-weight:500;color:var(--fb-t);pointer-events:none}

  /* tree */
  .fb-tree{padding:10px}
  .fb-titem{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:7px;
    cursor:pointer;margin-bottom:2px;border:1.5px solid transparent}
  .fb-titem:hover{background:var(--fb-sec)}
  .fb-titem.active{background:var(--fb-al);border-color:var(--fb-af)}
  .fb-tnum{color:var(--fb-t3);font-size:11px;width:16px;text-align:center;flex-shrink:0}
  .fb-ttype{font-size:11px;color:var(--fb-t3);font-family:monospace;flex-shrink:0}
  .fb-tname{font-size:13px;color:var(--fb-t);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .fb-tdot{width:6px;height:6px;border-radius:50%;background:var(--fb-danger);flex-shrink:0}

  /* canvas */
  .fb-canvas{flex:1;overflow-y:auto;padding:24px 32px}
  .fb-ci{max-width:660px;margin:0 auto}
  .fb-titlerow{margin-bottom:20px;display:flex;align-items:center;gap:12px}
  .fb-titleinp{font-size:20px;font-weight:600;color:var(--fb-t);border:none;background:none;
    outline:none;font-family:inherit;flex:1}
  .fb-draftbadge{font-size:12px;padding:3px 10px;border-radius:20px;background:var(--fb-sec);
    color:var(--fb-t3);border:1.5px solid var(--fb-border);flex-shrink:0}

  /* drop line */
  .fb-dl{height:4px;border-radius:2px;background:var(--fb-accent);
    margin:0;opacity:0;transition:opacity .12s;pointer-events:none;
    box-shadow:0 0 6px var(--fb-ag)}
  .fb-dl.over{opacity:1}
  .fb-dz{height:14px;margin:-7px 0;position:relative;z-index:4;cursor:default}

  /* empty canvas */
  .fb-empty{min-height:200px;border-radius:12px;border:2px dashed var(--fb-border);
    display:flex;align-items:center;justify-content:center;text-align:center;transition:all .15s}
  .fb-empty.over{border-color:var(--fb-accent);background:var(--fb-al)}
  .fb-ei{font-size:32px;margin-bottom:10px;opacity:.4}
  .fb-et{font-size:14px;font-weight:500;color:var(--fb-t3);margin-bottom:4px}
  .fb-es{font-size:12px;color:var(--fb-t3)}

  .fb-addbtn{margin-top:12px;width:100%;padding:11px;border:2px dashed var(--fb-border);
    border-radius:10px;background:none;cursor:pointer;color:var(--fb-t3);
    font-size:13px;font-weight:500;font-family:inherit}
  .fb-addbtn:hover{border-color:var(--fb-accent);color:var(--fb-accent)}

  /* canvas card */
  .fb-card{position:relative;padding:14px 16px 14px 36px;border-radius:10px;
    border:2px solid var(--fb-border);background:var(--fb-panel);cursor:pointer;
    transition:border-color .12s,box-shadow .12s;user-select:none}
  .fb-card:hover{border-color:var(--fb-af)}
  .fb-card.selected{border-color:var(--fb-accent);background:#FAFBFF;
    box-shadow:0 0 0 3px var(--fb-ag)}
  .fb-card.dragging{opacity:.3}
  .fb-handle{position:absolute;left:0;top:0;bottom:0;width:30px;
    display:flex;align-items:center;justify-content:center;
    cursor:grab;color:var(--fb-t3);font-size:15px;
    border-radius:10px 0 0 10px;user-select:none;touch-action:none}
  .fb-handle:hover{color:var(--fb-t2)}
  .fb-del{position:absolute;top:8px;right:8px;background:none;border:none;
    cursor:pointer;color:var(--fb-t3);font-size:14px;padding:2px 6px;
    border-radius:5px;line-height:1;display:none;font-family:inherit}
  .fb-card.selected .fb-del{display:block}
  .fb-del:hover{color:var(--fb-danger);background:#fff0f0}
  .fb-cmeta{display:flex;align-items:center;gap:6px;margin-bottom:7px}
  .fb-ctype{font-size:10px;padding:2px 6px;border-radius:4px;background:var(--fb-sec);
    color:var(--fb-t3);font-family:monospace;font-weight:500}
  .fb-creq{font-size:10px;color:var(--fb-danger);font-weight:700}
  .fb-clbl{display:block;font-size:13px;font-weight:500;color:var(--fb-t);margin-bottom:6px}
  .fb-ast{color:var(--fb-danger);margin-left:3px}
  .fb-cdesc{margin:6px 0 0;font-size:12px;color:var(--fb-t3)}

  /* field previews */
  .fb-fi{width:100%;padding:7px 10px;border:1.5px solid var(--fb-border);border-radius:7px;
    font-size:13px;color:var(--fb-t);background:var(--fb-input);outline:none;
    font-family:inherit;pointer-events:none}
  .fb-fta{height:60px;resize:none}
  .fb-fopts{display:flex;flex-direction:column;gap:6px}
  .fb-fopt{display:flex;align-items:center;gap:8px;font-size:13px;
    color:var(--fb-t2);pointer-events:none}
  .fb-fopt input{accent-color:var(--fb-accent);flex-shrink:0;pointer-events:none}
  .fb-ftog{display:flex;align-items:center;gap:10px;pointer-events:none}
  .fb-ftogtrack{width:36px;height:20px;border-radius:10px;background:var(--fb-accent);
    display:inline-flex;align-items:center;padding:0 2px;flex-shrink:0}
  .fb-ftogthumb{width:16px;height:16px;border-radius:50%;background:#fff;margin-left:auto}
  .fb-fh3{font-size:17px;font-weight:600;color:var(--fb-t)}
  .fb-fhr{border:none;border-top:1.5px solid var(--fb-border);margin:4px 0}
  .fb-ffile{display:flex;align-items:center;gap:8px;color:var(--fb-t3);pointer-events:none}

  /* right panel */
  .fb-right{width:284px;background:var(--fb-panel);border-left:1.5px solid var(--fb-border);
    display:flex;flex-direction:column;flex-shrink:0}
  .fb-rtabs{display:flex;border-bottom:1.5px solid var(--fb-border);overflow-x:auto;flex-shrink:0}
  .fb-rtab{flex:1;padding:11px 4px;border:none;background:none;cursor:pointer;font-size:11px;
    font-weight:500;white-space:nowrap;text-transform:capitalize;color:var(--fb-t2);
    border-bottom:2px solid transparent;margin-bottom:-1.5px;font-family:inherit}
  .fb-rtab.active{color:var(--fb-accent);border-bottom-color:var(--fb-accent)}
  .fb-rscroll{flex:1;overflow-y:auto}
  .fb-rempty{padding:28px;text-align:center}
  .fb-rempty-arrow{font-size:40px;opacity:.2;margin-bottom:10px}
  .fb-rempty-txt{color:var(--fb-t3);font-size:13px}

  /* props form */
  .fb-stabs{display:flex;border-bottom:1.5px solid var(--fb-border);
    margin-bottom:14px;overflow-x:auto}
  .fb-stab{padding:8px 9px;border:none;background:none;cursor:pointer;font-size:11px;
    font-weight:500;white-space:nowrap;text-transform:capitalize;color:var(--fb-t2);
    border-bottom:2px solid transparent;margin-bottom:-1.5px;font-family:inherit}
  .fb-stab.active{color:var(--fb-accent);border-bottom-color:var(--fb-accent)}
  .fb-pform{padding:16px}
  .fb-prow{margin-bottom:14px}
  .fb-plbl2{display:block;font-size:12px;font-weight:500;color:var(--fb-t2);margin-bottom:5px}
  .fb-pinp{width:100%;padding:7px 10px;border:1.5px solid var(--fb-border);border-radius:7px;
    font-size:13px;color:var(--fb-t);background:var(--fb-input);outline:none;font-family:inherit}
  .fb-pinp:focus{border-color:var(--fb-accent);box-shadow:0 0 0 3px var(--fb-ag)}
  .fb-mono{font-family:monospace;font-size:12px}
  .fb-togrow{display:flex;align-items:center;gap:8px;cursor:pointer}
  .fb-togwrap{position:relative;width:36px;height:20px;flex-shrink:0}
  .fb-togwrap input{opacity:0;position:absolute;inset:0;cursor:pointer;margin:0;width:100%;height:100%}
  .fb-togbg{width:100%;height:100%;border-radius:10px;background:var(--fb-border);
    transition:background .2s;pointer-events:none}
  .fb-togwrap input:checked~.fb-togbg{background:var(--fb-accent)}
  .fb-togknob{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;
    background:#fff;transition:left .2s;pointer-events:none;box-shadow:0 1px 3px rgba(0,0,0,.2)}
  .fb-togwrap input:checked~.fb-togknob{left:18px}
  .fb-toglbl{font-size:13px;color:var(--fb-t)}
  .fb-segs{display:flex;gap:6px}
  .fb-seg{flex:1;padding:7px 0;border:1.5px solid var(--fb-border);border-radius:7px;
    background:none;cursor:pointer;font-size:12px;font-weight:500;color:var(--fb-t2);font-family:inherit}
  .fb-seg.active{border-color:var(--fb-accent);background:var(--fb-al);color:var(--fb-accent)}
  .fb-optlist{display:flex;flex-direction:column;gap:6px;margin-bottom:8px}
  .fb-optrow{display:flex;gap:5px;align-items:center}
  .fb-optrow .fb-pinp{flex:1}
  .fb-delopt{background:none;border:none;cursor:pointer;color:var(--fb-t3);
    font-size:14px;padding:0 4px;font-family:inherit;flex-shrink:0}
  .fb-delopt:hover{color:var(--fb-danger)}
  .fb-addopt{width:100%;padding:7px;border:1.5px dashed var(--fb-border);border-radius:7px;
    background:none;cursor:pointer;color:var(--fb-accent);font-size:12px;font-weight:500;font-family:inherit}
  .fb-valrule{display:flex;align-items:center;gap:8px;margin-bottom:10px;cursor:pointer;
    font-size:13px;font-family:monospace;color:var(--fb-t)}
  .fb-valrule input{accent-color:var(--fb-accent);width:14px;height:14px;cursor:pointer}
  .fb-stubbtn{width:100%;padding:10px;border:1.5px dashed var(--fb-border);border-radius:8px;
    background:none;cursor:pointer;color:var(--fb-accent);font-size:13px;
    font-weight:500;font-family:inherit}
  .fb-muted{font-size:12px;color:var(--fb-t3);text-align:center;margin-top:16px}

  /* theme / export / model */
  .fb-tpanel,.fb-epanel,.fb-mpanel{padding:16px}
  .fb-swatches{display:flex;gap:8px;flex-wrap:wrap}
  .fb-swatch{width:28px;height:28px;border-radius:7px;border:2px solid transparent;cursor:pointer}
  .fb-swatch:hover{transform:scale(1.12)}
  .fb-swatch.active{box-shadow:0 0 0 3px #fff,0 0 0 5px var(--fb-accent)}
  .fb-enote{font-size:13px;color:var(--fb-t2);margin-bottom:12px}
  .fb-copybtn{width:100%;padding:10px;background:var(--fb-accent);border:none;
    border-radius:8px;color:#fff;font-weight:600;font-size:13px;cursor:pointer;font-family:inherit}
  .fb-copybtn:hover{background:#2a5ce0}
  .fb-mjson{margin:0;font-size:11px;line-height:1.7;color:var(--fb-t2);background:var(--fb-sec);
    padding:14px;border-radius:8px;overflow-x:auto;font-family:monospace;white-space:pre-wrap}

  /* preview */
  .fb-preview{flex:1;overflow-y:auto;padding:32px 24px}
  .fb-pcard{max-width:560px;margin:0 auto;background:var(--fb-panel);border-radius:14px;
    border:1.5px solid var(--fb-border);padding:32px;box-shadow:0 4px 24px rgba(0,0,0,.06)}
  .fb-prvform{display:flex;flex-direction:column;gap:20px}
  .fb-pgrp{display:flex;flex-direction:column;gap:6px}
  .fb-pfl{font-size:14px;font-weight:500;color:var(--fb-t)}
  .fb-pfl .fb-ast{color:var(--fb-danger);margin-left:3px}
  .fb-pfinp{width:100%;padding:9px 12px;border:1.5px solid var(--fb-border);border-radius:8px;
    font-size:14px;color:var(--fb-t);background:var(--fb-input);outline:none;font-family:inherit}
  .fb-pfinp:focus{border-color:var(--fb-accent);box-shadow:0 0 0 3px var(--fb-ag)}
  .fb-pfhelp{font-size:12px;color:var(--fb-t3)}
  .fb-pfsub{padding:11px 24px;background:var(--fb-accent);border:none;border-radius:8px;
    color:#fff;font-size:14px;font-weight:600;cursor:pointer;align-self:flex-start;font-family:inherit}
  .fb-pfempty{text-align:center;color:var(--fb-t3);padding:40px 0}

  /* code */
  .fb-code{flex:1;overflow-y:auto;padding:24px}
  .fb-ccard{max-width:720px;margin:0 auto;background:var(--fb-panel);border-radius:12px;
    border:1.5px solid var(--fb-border);overflow:hidden}
  .fb-chdr{padding:12px 16px;border-bottom:1.5px solid var(--fb-border);
    display:flex;align-items:center;justify-content:space-between}
  .fb-ctitle{font-size:12px;font-weight:500;color:var(--fb-t2)}
  .fb-cjson{margin:0;padding:20px;font-size:12px;line-height:1.7;color:var(--fb-t2);
    font-family:monospace;white-space:pre-wrap;overflow-x:auto}
`;
```

Now the root component with state and toolbar rendering:

```tsx
export default function FormBuilder({
  initialFields,
  fieldTypes,
  formName: initName,
  formType: initType,
  formDescription: initDesc,
  onSave,
  onCancel,
  isEditing,
}: FormBuilderProps) {
  const [fields, setFields] = useState<FormField[]>(initialFields);
  const [name, setName] = useState(initName);
  const [description, setDescription] = useState(initDesc);
  const [formType, setFormType] = useState(initType);
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

  // Cosmetic per-field state (not persisted)
  const [fieldMeta, setFieldMeta] = useState<
    Record<string, { size: string; columns: number }>
  >({});

  const drag = useRef<{
    type: 'palette' | 'canvas' | null;
    payload: string | null;
  }>({ type: null, payload: null });

  const selectedField = fields.find((f) => f.id === selectedId) ?? null;

  // Inject CSS once
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

  const pushHistory = useCallback((snapshot: FormField[]) => {
    setHistory((h) => [...h.slice(-30), JSON.parse(JSON.stringify(snapshot))]);
  }, []);

  const undo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setFields(prev);
  };

  const handleClear = async () => {
    if (fields.length === 0) return;
    const confirmed = await GuardianSweetAlert.showConfirmation(
      'Clear All Fields',
      `Remove all ${fields.length} field${fields.length === 1 ? '' : 's'}? This can be undone with Undo.`,
      { confirmText: 'Clear', cancelText: 'Keep', severity: 'medium', dangerousAction: false }
    );
    if (confirmed) {
      pushHistory(fields);
      setFields([]);
      setSelectedId(null);
      toast.success('Canvas cleared');
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Form name is required');
      return;
    }
    setSaving(true);
    try {
      await onSave({ name, description, type: formType, fields });
      setFormStatus('saved');
      setTimeout(() => setFormStatus('draft'), 3000);
    } catch {
      toast.error('Failed to save form');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fb-wrap">
      {/* ── Toolbar ── */}
      <div className="fb-toolbar">
        <div className="fb-logo">
          <div className="fb-logo-mark">FB</div>
        </div>
        <input
          className="fb-titleinp"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Untitled Form"
          style={{ maxWidth: 260 }}
        />
        <span className={`fb-badge${formStatus === 'saved' ? ' saved' : ''}`}>
          {formStatus === 'saved' ? 'Saved' : 'Draft'}
        </span>
        <div className="fb-spacer" />
        <span className="fb-count">{fields.filter(f => !LAYOUT_TYPES.includes(f.fieldType)).length} fields</span>
        <div className="fb-vtoggle">
          {(['editor', 'preview', 'code'] as View[]).map((v) => (
            <button key={v} className={`fb-vbtn${view === v ? ' active' : ''}`} onClick={() => setView(v)}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        <button className="fb-btn" onClick={undo} disabled={history.length === 0}>Undo</button>
        <button className="fb-btn" onClick={handleClear} disabled={fields.length === 0}>Clear</button>
        <button className="fb-btn" onClick={onCancel}>Cancel</button>
        <button className="fb-btn fb-btn-p" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {/* ── Body (panels rendered in subsequent tasks) ── */}
      <div className="fb-body">
        {view === 'editor' && <div className="fb-left"><p style={{padding:16,color:'var(--fb-t3)'}}>Palette (Task 3)</p></div>}
        <div className="fb-canvas"><div className="fb-ci"><p style={{color:'var(--fb-t3)'}}>Canvas (Task 4)</p></div></div>
        {view === 'editor' && <div className="fb-right"><p style={{padding:16,color:'var(--fb-t3)'}}>Properties (Task 5)</p></div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd "/Users/epena/Desktop/www/projects/Guardian MVP" && npx tsc --noEmit --pretty 2>&1 | head -20`

Expected: No errors related to `FormBuilder.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/components/FormBuilder/FormBuilder.tsx src/components/FormBuilder/index.ts
git commit -m "feat: add FormBuilder skeleton with toolbar, CSS, and state"
```

---

### Task 3: Left Panel — Palette + Tree View

**Files:**
- Modify: `src/components/FormBuilder/FormBuilder.tsx`

This task replaces the placeholder left panel with the field type palette (2-column grid, grouped, searchable, draggable) and tree view tab.

- [ ] **Step 1: Add palette grouping logic**

Add this function above the `FormBuilder` component, after the `LAYOUT_FIELD_DEFS` constant:

```tsx
/* ─── Group field types for the palette ─────────────────── */
function groupFieldTypes(dbTypes: UiFieldType[]): { label: string; fields: { type: string; label: string; icon: string; dbFieldTypeId?: number }[] }[] {
  const basicTypes = ['text_input', 'text', 'textarea', 'number', 'email', 'phone'];
  const selectTypes = ['dropdown', 'select', 'radio', 'checkbox', 'checkboxes'];
  const dateTypes = ['date', 'time', 'datetime', 'date_time'];
  const fileTypes = ['file', 'file_upload'];

  const basic: typeof LAYOUT_FIELD_DEFS & { dbFieldTypeId?: number }[] = [];
  const selection: typeof basic = [];
  const dateTime: typeof basic = [];
  const file: typeof basic = [];
  const specialized: typeof basic = [];

  const iconMap: Record<string, string> = {
    text_input: 'T', text: 'T', textarea: '¶', number: '#', email: '@', phone: '☎',
    dropdown: '▾', select: '▾', radio: '◎', checkbox: '✓', checkboxes: '✓',
    date: '▦', time: '◷', datetime: '▦◷', date_time: '▦◷',
    file: '↑', file_upload: '↑', image: '▣',
    ssn: '***', dob: '▦', account_number: '#', address: '⌂',
  };

  for (const ft of dbTypes) {
    const norm = ft.type.toLowerCase();
    const item = { type: ft.type, label: ft.label, icon: iconMap[norm] || 'T', dbFieldTypeId: ft.dbFieldTypeId };
    if (basicTypes.includes(norm)) basic.push(item);
    else if (selectTypes.includes(norm)) selection.push(item);
    else if (dateTypes.includes(norm)) dateTime.push(item);
    else if (fileTypes.includes(norm)) file.push(item);
    else specialized.push(item);
  }

  const groups: { label: string; fields: typeof basic }[] = [];
  if (basic.length) groups.push({ label: 'Basic', fields: basic });
  if (selection.length) groups.push({ label: 'Selection', fields: selection });
  if (dateTime.length) groups.push({ label: 'Date & Time', fields: dateTime });
  if (specialized.length) groups.push({ label: 'Specialized', fields: specialized });
  if (file.length) groups.push({ label: 'File', fields: file });
  groups.push({ label: 'Layout', fields: LAYOUT_FIELD_DEFS });
  return groups;
}
```

- [ ] **Step 2: Add the addField and palette drag handlers inside FormBuilder**

Add these functions inside `FormBuilder`, after the `handleSave` function:

```tsx
  const addField = (type: string, dbFieldTypeId?: number) => {
    const nf = mkField(type, dbFieldTypeId);
    nf.sequence = fields.length + 1;
    pushHistory(fields);
    setFields((prev) => [...prev, nf]);
    setSelectedId(nf.id);
    setSubTab('properties');
  };

  const updateField = (updated: FormField) => {
    pushHistory(fields);
    setFields((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
  };

  const deleteField = (id: string) => {
    pushHistory(fields);
    setFields((prev) => prev.filter((f) => f.id !== id));
    if (selectedId === id) setSelectedId(null);
  };
```

- [ ] **Step 3: Replace the left panel placeholder with palette + tree**

Replace the left panel placeholder `{view === 'editor' && <div className="fb-left"><p ...>Palette (Task 3)</p></div>}` with:

```tsx
        {view === 'editor' && (
          <div className="fb-left">
            <div className="fb-ptabs">
              <button className={`fb-ptab${leftTab === 'elements' ? ' active' : ''}`} onClick={() => setLeftTab('elements')}>Elements</button>
              <button className={`fb-ptab${leftTab === 'tree' ? ' active' : ''}`} onClick={() => setLeftTab('tree')}>Tree</button>
            </div>
            <div className="fb-pbody">
              {leftTab === 'elements' ? (
                <>
                  <div className="fb-srchwrap">
                    <input className="fb-srch" placeholder="Search fields…" value={search} onChange={(e) => setSearch(e.target.value)} />
                  </div>
                  <p className="fb-hint">Click to add or drag to insert at position</p>
                  {(() => {
                    const allGroups = groupFieldTypes(fieldTypes);
                    const groups = search
                      ? [{ label: 'Results', fields: allGroups.flatMap((g) => g.fields).filter((f) => f.label.toLowerCase().includes(search.toLowerCase())) }]
                      : allGroups;
                    return groups.map((group) => (
                      <div key={group.label} className="fb-grp">
                        <div className="fb-glbl">{group.label}</div>
                        <div className="fb-pgrid">
                          {group.fields.map((f) => (
                            <div
                              key={f.type}
                              className="fb-pitem"
                              draggable
                              onClick={() => addField(f.type, (f as any).dbFieldTypeId)}
                              onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', f.type);
                                drag.current = { type: 'palette', payload: f.type };
                                (e.target as HTMLElement).classList.add('dragging');
                              }}
                              onDragEnd={(e) => (e.target as HTMLElement).classList.remove('dragging')}
                            >
                              <span className="fb-picon">{f.icon}</span>
                              <span className="fb-plbl">{f.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ));
                  })()}
                </>
              ) : (
                <div className="fb-tree">
                  {fields.length === 0 ? (
                    <p style={{ color: 'var(--fb-t3)', fontSize: 13, textAlign: 'center', padding: 20 }}>No fields yet</p>
                  ) : (
                    fields.map((f, i) => (
                      <div
                        key={f.id}
                        className={`fb-titem${selectedId === f.id ? ' active' : ''}`}
                        onClick={() => { setSelectedId(f.id); setSubTab('properties'); }}
                      >
                        <span className="fb-tnum">{i + 1}</span>
                        <span className="fb-ttype">{f.fieldType}</span>
                        <span className="fb-tname">{f.fieldName}</span>
                        {f.required && <span className="fb-tdot" />}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}
```

- [ ] **Step 4: Verify it compiles**

Run: `cd "/Users/epena/Desktop/www/projects/Guardian MVP" && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 5: Commit**

```bash
git add src/components/FormBuilder/FormBuilder.tsx
git commit -m "feat: add FormBuilder left panel with palette and tree view"
```

---

### Task 4: Center Canvas — Cards + Drag-and-Drop

**Files:**
- Modify: `src/components/FormBuilder/FormBuilder.tsx`

This task replaces the canvas placeholder with field cards, drop zones, the empty state, and drag-and-drop handling.

- [ ] **Step 1: Add FieldPreview sub-component**

Add this above the `FormBuilder` component, after `groupFieldTypes`:

```tsx
/* ─── FieldPreview (canvas card inline preview) ─────────── */
function FieldPreview({ field }: { field: FormField }) {
  const opts = field.options ? field.options.split(',').map((o) => o.trim()).filter(Boolean) : [];
  const norm = field.fieldType.toLowerCase();

  if (norm === 'textarea') return <textarea className="fb-fi fb-fta" placeholder={field.placeholder || 'Enter text…'} readOnly />;
  if (norm === 'dropdown' || norm === 'select')
    return <select className="fb-fi" disabled><option>{field.placeholder || 'Select…'}</option>{opts.map((o) => <option key={o}>{o}</option>)}</select>;
  if (norm === 'checkbox' || norm === 'checkboxes')
    return <div className="fb-fopts">{(opts.length ? opts : ['Option 1', 'Option 2']).map((o) => <label key={o} className="fb-fopt"><input type="checkbox" readOnly />{o}</label>)}</div>;
  if (norm === 'radio')
    return <div className="fb-fopts">{(opts.length ? opts : ['Option 1', 'Option 2']).map((o) => <label key={o} className="fb-fopt"><input type="radio" readOnly name={field.id} />{o}</label>)}</div>;
  if (norm === 'header') return <div className="fb-fh3">{field.fieldName}</div>;
  if (norm === 'divider') return <hr className="fb-fhr" />;
  if (norm === 'file' || norm === 'file_upload')
    return <div className="fb-fi fb-ffile"><span>↑</span><span>Click to upload</span></div>;
  if (norm === 'date' || norm === 'dob') return <input className="fb-fi" type="date" readOnly />;
  if (norm === 'time') return <input className="fb-fi" type="time" readOnly />;
  if (norm === 'datetime' || norm === 'date_time') return <input className="fb-fi" type="datetime-local" readOnly />;
  return <input className="fb-fi" type="text" placeholder={field.placeholder || `Enter ${field.fieldName.toLowerCase()}…`} readOnly />;
}
```

- [ ] **Step 2: Add handleDrop inside FormBuilder**

Add after `deleteField`:

```tsx
  const handleDrop = useCallback(
    (insertAt: number) => {
      setDropOver(null);
      if (drag.current.type === 'palette' && drag.current.payload) {
        // Find the dbFieldTypeId for the dropped type
        const matchedType = fieldTypes.find((ft) => ft.type === drag.current.payload);
        const nf = mkField(drag.current.payload!, matchedType?.dbFieldTypeId);
        pushHistory(fields);
        setFields((prev) => {
          const arr = [...prev];
          arr.splice(insertAt, 0, nf);
          return arr.map((f, i) => ({ ...f, sequence: i + 1 }));
        });
        setSelectedId(nf.id);
        setSubTab('properties');
      } else if (drag.current.type === 'canvas' && drag.current.payload) {
        const srcIdx = fields.findIndex((f) => f.id === drag.current.payload);
        if (srcIdx === -1) return;
        let tgt = insertAt;
        if (tgt > srcIdx) tgt--;
        if (tgt === srcIdx) return;
        pushHistory(fields);
        setFields((prev) => {
          const arr = [...prev];
          const [moved] = arr.splice(srcIdx, 1);
          arr.splice(tgt, 0, moved);
          return arr.map((f, i) => ({ ...f, sequence: i + 1 }));
        });
      }
      drag.current = { type: null, payload: null };
    },
    [fields, fieldTypes, pushHistory]
  );
```

- [ ] **Step 3: Add DropZone inline component inside FormBuilder**

Add after `handleDrop`:

```tsx
  const DropZone = ({ index }: { index: number }) => (
    <div
      className="fb-dz"
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = drag.current.type === 'canvas' ? 'move' : 'copy';
        setDropOver(index);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropOver(null);
      }}
      onDrop={(e) => {
        e.preventDefault();
        handleDrop(index);
      }}
    >
      <div className={`fb-dl${dropOver === index ? ' over' : ''}`} />
    </div>
  );
```

- [ ] **Step 4: Replace the canvas placeholder**

Replace `<div className="fb-canvas"><div className="fb-ci"><p style={{color:'var(--fb-t3)'}}>Canvas (Task 4)</p></div></div>` with:

```tsx
        <div className="fb-canvas">
          <div className="fb-ci">
            {/* Form title row */}
            <div className="fb-titlerow">
              <input className="fb-titleinp" value={name} onChange={(e) => setName(e.target.value)} placeholder="Untitled Form" />
              <span className="fb-draftbadge">{isEditing ? 'Editing' : 'New'}</span>
            </div>

            {/* Description */}
            <div style={{ marginBottom: 20 }}>
              <input
                className="fb-pinp"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Form description (optional)"
              />
            </div>

            {fields.length === 0 ? (
              <div
                className={`fb-empty${dropOver === 0 ? ' over' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDropOver(0); }}
                onDragLeave={() => setDropOver(null)}
                onDrop={(e) => { e.preventDefault(); handleDrop(0); }}
              >
                <div>
                  <div className="fb-ei">+</div>
                  <div className="fb-et">Drop fields here</div>
                  <div className="fb-es">Or click a field type in the left panel</div>
                </div>
              </div>
            ) : (
              <>
                <DropZone index={0} />
                {fields.map((field, idx) => (
                  <div key={field.id}>
                    <div
                      className={`fb-card${selectedId === field.id ? ' selected' : ''}`}
                      onClick={() => { setSelectedId(field.id); setSubTab('properties'); }}
                    >
                      <div
                        className="fb-handle"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', field.id);
                          drag.current = { type: 'canvas', payload: field.id };
                        }}
                      >
                        ⠿
                      </div>
                      <button className="fb-del" onClick={(e) => { e.stopPropagation(); deleteField(field.id); }}>✕</button>
                      <div className="fb-cmeta">
                        <span className="fb-ctype">{field.fieldType}</span>
                        {field.required && <span className="fb-creq">REQUIRED</span>}
                      </div>
                      <span className="fb-clbl">
                        {field.fieldName}
                        {field.required && <span className="fb-ast">*</span>}
                      </span>
                      {!LAYOUT_TYPES.includes(field.fieldType) && <FieldPreview field={field} />}
                      {field.helpText && <p className="fb-cdesc">{field.helpText}</p>}
                    </div>
                    <DropZone index={idx + 1} />
                  </div>
                ))}
              </>
            )}

            {fields.length > 0 && (
              <button className="fb-addbtn" onClick={() => addField('text_input', fieldTypes.find(ft => ft.type === 'text_input')?.dbFieldTypeId)}>
                + Add field
              </button>
            )}
          </div>
        </div>
```

- [ ] **Step 5: Verify it compiles**

Run: `cd "/Users/epena/Desktop/www/projects/Guardian MVP" && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 6: Commit**

```bash
git add src/components/FormBuilder/FormBuilder.tsx
git commit -m "feat: add FormBuilder canvas with cards and drag-and-drop"
```

---

### Task 5: Right Panel — Properties Editor

**Files:**
- Modify: `src/components/FormBuilder/FormBuilder.tsx`

This task replaces the right panel placeholder with the properties editor (5 sub-tabs).

- [ ] **Step 1: Add PropsPanel sub-component**

Add this above `FormBuilder`, after `FieldPreview`:

```tsx
/* ─── PropsPanel ─────────────────────────────────────────── */
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
  const TABS: SubTab[] = ['properties', 'data', 'layout', 'validation', 'conditions'];
  const isOptionType = ['dropdown', 'select', 'radio', 'checkbox', 'checkboxes'].includes(field.fieldType.toLowerCase());

  // Parse options from comma-separated string
  const parsedOptions = field.options
    ? field.options.split(',').map((o) => o.trim()).filter(Boolean)
    : [];

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="fb-prow">
      <label className="fb-plbl2">{label}</label>
      {children}
    </div>
  );

  return (
    <div className="fb-pform">
      <div className="fb-stabs">
        {TABS.map((t) => (
          <button key={t} className={`fb-stab${subTab === t ? ' active' : ''}`} onClick={() => setSubTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {subTab === 'properties' && (
        <>
          <Row label="Label">
            <input className="fb-pinp" value={field.fieldName} onChange={(e) => onChange({ ...field, fieldName: e.target.value })} />
          </Row>
          <Row label="Placeholder">
            <input className="fb-pinp" value={field.placeholder || ''} onChange={(e) => onChange({ ...field, placeholder: e.target.value })} />
          </Row>
          <Row label="Help text">
            <input className="fb-pinp" value={field.helpText || ''} onChange={(e) => onChange({ ...field, helpText: e.target.value })} />
          </Row>
          <Row label="Required">
            <label className="fb-togrow">
              <div className="fb-togwrap">
                <input type="checkbox" checked={field.required} onChange={(e) => onChange({ ...field, required: e.target.checked })} />
                <div className="fb-togbg" />
                <div className="fb-togknob" />
              </div>
              <span className="fb-toglbl">Required field</span>
            </label>
          </Row>
        </>
      )}

      {subTab === 'data' && (
        isOptionType ? (
          <Row label="Options">
            <div className="fb-optlist">
              {parsedOptions.map((opt, i) => (
                <div key={i} className="fb-optrow">
                  <input
                    className="fb-pinp"
                    value={opt}
                    placeholder="Option label"
                    onChange={(e) => {
                      const newOpts = [...parsedOptions];
                      newOpts[i] = e.target.value;
                      onChange({ ...field, options: newOpts.join(', ') });
                    }}
                  />
                  <button className="fb-delopt" type="button" onClick={() => {
                    const newOpts = parsedOptions.filter((_, j) => j !== i);
                    onChange({ ...field, options: newOpts.join(', ') });
                  }}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              className="fb-addopt"
              type="button"
              onClick={() => onChange({ ...field, options: [...parsedOptions, `Option ${parsedOptions.length + 1}`].join(', ') })}
            >
              + Add option
            </button>
          </Row>
        ) : (
          <p style={{ color: 'var(--fb-t3)', fontSize: 13 }}>No data options for this field type.</p>
        )
      )}

      {subTab === 'layout' && (
        <>
          <Row label="Size">
            <div className="fb-segs">
              {['sm', 'md', 'lg'].map((s) => (
                <button key={s} type="button" className="fb-seg" onClick={() => {}}>{s.toUpperCase()}</button>
              ))}
            </div>
          </Row>
          <Row label="Column span">
            <div className="fb-segs">
              {[['1', '1/3'], ['2', '2/3'], ['3', 'Full']].map(([v, l]) => (
                <button key={v} type="button" className="fb-seg" onClick={() => {}}>{l}</button>
              ))}
            </div>
          </Row>
          <p className="fb-muted">Layout options are for preview only</p>
        </>
      )}

      {subTab === 'validation' && (
        <div>
          <p style={{ fontSize: 13, color: 'var(--fb-t2)', marginBottom: 12 }}>Add validation rules.</p>
          {['required', 'min', 'max', 'email', 'url', 'regex', 'numeric', 'alpha'].map((rule) => {
            const currentRules = field.validation ? field.validation.split(',').map((r) => r.trim()) : [];
            return (
              <label key={rule} className="fb-valrule">
                <input
                  type="checkbox"
                  checked={currentRules.includes(rule)}
                  onChange={(e) => {
                    const newRules = e.target.checked ? [...currentRules, rule] : currentRules.filter((r) => r !== rule);
                    onChange({ ...field, validation: newRules.join(', ') });
                  }}
                />
                {rule}
              </label>
            );
          })}
        </div>
      )}

      {subTab === 'conditions' && (
        <div>
          <p style={{ fontSize: 13, color: 'var(--fb-t2)', marginBottom: 12 }}>Show or hide this field based on other field values.</p>
          <button className="fb-stubbtn" type="button">+ Add condition</button>
          <p className="fb-muted">No conditions — always shown.</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Replace the right panel placeholder**

Replace `{view === 'editor' && <div className="fb-right"><p style={{padding:16,color:'var(--fb-t3)'}}>Properties (Task 5)</p></div>}` with:

```tsx
        {view === 'editor' && (
          <div className="fb-right">
            <div className="fb-rscroll">
              {selectedField ? (
                <PropsPanel
                  field={selectedField}
                  subTab={subTab}
                  setSubTab={setSubTab}
                  onChange={updateField}
                />
              ) : (
                <div className="fb-rempty">
                  <div className="fb-rempty-arrow">←</div>
                  <div className="fb-rempty-txt">Select a field to edit its properties</div>
                </div>
              )}

              {/* Theme section (always visible at bottom of right panel) */}
              <div className="fb-tpanel" style={{ borderTop: '1.5px solid var(--fb-border)' }}>
                <label className="fb-plbl2">Accent Color</label>
                <div className="fb-swatches">
                  {['#3B6EF0', '#E53935', '#43A047', '#FB8C00', '#8E24AA', '#00ACC1'].map((hex) => (
                    <div
                      key={hex}
                      className={`fb-swatch${accentColor === hex ? ' active' : ''}`}
                      style={{ background: hex }}
                      onClick={() => {
                        setAccentColor(hex);
                        const el = document.querySelector('.fb-wrap') as HTMLElement;
                        if (el) {
                          const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
                          el.style.setProperty('--fb-accent', hex);
                          el.style.setProperty('--fb-al', `rgba(${r},${g},${b},.08)`);
                          el.style.setProperty('--fb-ag', `rgba(${r},${g},${b},.14)`);
                          el.style.setProperty('--fb-af', `rgba(${r},${g},${b},.35)`);
                        }
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd "/Users/epena/Desktop/www/projects/Guardian MVP" && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add src/components/FormBuilder/FormBuilder.tsx
git commit -m "feat: add FormBuilder right panel with properties editor"
```

---

### Task 6: Preview + Code Views

**Files:**
- Modify: `src/components/FormBuilder/FormBuilder.tsx`

This task adds the Preview and Code views that replace the three-panel layout when toggled.

- [ ] **Step 1: Add PreviewMode sub-component**

Add this above `FormBuilder`, after `PropsPanel`:

```tsx
/* ─── PreviewMode ────────────────────────────────────────── */
function PreviewMode({ fields }: { fields: FormField[] }) {
  const renderInput = (f: FormField) => {
    const norm = f.fieldType.toLowerCase();
    const opts = f.options ? f.options.split(',').map((o) => o.trim()).filter(Boolean) : [];
    switch (norm) {
      case 'textarea':
        return <textarea className="fb-pfinp" style={{ minHeight: 80, resize: 'vertical' }} placeholder={f.placeholder} />;
      case 'dropdown': case 'select':
        return <select className="fb-pfinp"><option value="">{f.placeholder || 'Select…'}</option>{opts.map((o) => <option key={o} value={o}>{o}</option>)}</select>;
      case 'checkbox': case 'checkboxes':
        return <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{(opts.length ? opts : ['Option 1']).map((o) => <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}><input type="checkbox" style={{ accentColor: 'var(--fb-accent)' }} />{o}</label>)}</div>;
      case 'radio':
        return <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{(opts.length ? opts : ['Option 1']).map((o) => <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}><input type="radio" name={f.id} style={{ accentColor: 'var(--fb-accent)' }} />{o}</label>)}</div>;
      case 'header':
        return <h3 style={{ margin: '6px 0 2px', fontSize: 20, fontWeight: 600, color: 'var(--fb-t)' }}>{f.fieldName}</h3>;
      case 'divider':
        return <hr style={{ border: 'none', borderTop: '1.5px solid var(--fb-border)', margin: '4px 0' }} />;
      case 'file': case 'file_upload':
        return <div className="fb-pfinp" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--fb-t3)' }}><span>↑</span><span>Click to upload</span></div>;
      case 'date': case 'dob':
        return <input className="fb-pfinp" type="date" />;
      case 'time':
        return <input className="fb-pfinp" type="time" />;
      case 'datetime': case 'date_time':
        return <input className="fb-pfinp" type="datetime-local" />;
      default:
        return <input className="fb-pfinp" type="text" placeholder={f.placeholder} />;
    }
  };

  if (!fields.length) return <div className="fb-pfempty">Add fields to preview your form.</div>;
  const noLabel = ['header', 'divider'];
  return (
    <form className="fb-prvform" onSubmit={(e) => e.preventDefault()}>
      {fields.map((f) => (
        <div key={f.id} className="fb-pgrp">
          {!noLabel.includes(f.fieldType.toLowerCase()) && (
            <label className="fb-pfl">{f.fieldName}{f.required && <span className="fb-ast">*</span>}</label>
          )}
          {renderInput(f)}
          {f.helpText && <p className="fb-pfhelp">{f.helpText}</p>}
        </div>
      ))}
      <button type="submit" className="fb-pfsub">Submit</button>
    </form>
  );
}
```

- [ ] **Step 2: Add Preview + Code view rendering in the body**

In the `fb-body` div, make two changes:

**Change A:** Wrap the existing canvas `<div className="fb-canvas">...</div>` (from Task 4) in a `{view === 'editor' && (...)}` guard so it only renders in editor mode.

**Change B:** Add the preview and code view blocks right after the canvas closing tag, before the right panel. Insert these two new blocks:

```tsx
        {view === 'preview' && (
          <div className="fb-preview">
            <div className="fb-pcard">
              <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>{name || 'Untitled Form'}</h2>
              {description && <p style={{ fontSize: 14, color: 'var(--fb-t2)', marginBottom: 20 }}>{description}</p>}
              <PreviewMode fields={fields} />
            </div>
          </div>
        )}

        {view === 'code' && (
          <div className="fb-code">
            <div className="fb-ccard">
              <div className="fb-chdr">
                <span className="fb-ctitle">Form Schema — {fields.length} fields</span>
                <button
                  className="fb-copybtn"
                  style={{ width: 'auto', padding: '6px 14px' }}
                  onClick={() => {
                    const schema = fields.map(({ fieldName, fieldType, required, options, placeholder, helpText, validation }) => ({
                      fieldName, fieldType, required,
                      ...(placeholder && { placeholder }),
                      ...(helpText && { helpText }),
                      ...(options && { options }),
                      ...(validation && { validation }),
                    }));
                    navigator.clipboard.writeText(JSON.stringify(schema, null, 2));
                    toast.success('Copied to clipboard');
                  }}
                >
                  Copy
                </button>
              </div>
              <pre className="fb-cjson">
                {JSON.stringify(
                  fields.map(({ fieldName, fieldType, required, options, placeholder, helpText, validation }) => ({
                    fieldName, fieldType, required,
                    ...(placeholder && { placeholder }),
                    ...(helpText && { helpText }),
                    ...(options && { options }),
                    ...(validation && { validation }),
                  })),
                  null,
                  2
                )}
              </pre>
            </div>
          </div>
        )}
```

The left panel and right panel already have `{view === 'editor' && (...)}` guards from Tasks 3 and 5, so they automatically hide in preview/code views.

- [ ] **Step 3: Verify it compiles**

Run: `cd "/Users/epena/Desktop/www/projects/Guardian MVP" && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add src/components/FormBuilder/FormBuilder.tsx
git commit -m "feat: add FormBuilder preview and code views"
```

---

### Task 7: FormBuilderPage — Routing + Data Loading + Save

**Files:**
- Create: `src/pages/FormBuilderPage.tsx`

- [ ] **Step 1: Create FormBuilderPage.tsx**

```tsx
import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import FormBuilder from '../components/FormBuilder';
import { FormField } from '../types/formBuilder';
import { UiFieldType } from '../services/fieldTypeService';
import fieldTypeService from '../services/fieldTypeService';
import formService, { DbForm } from '../services/formService';
import { toast } from 'react-toastify';

const LAYOUT_TYPES = ['header', 'divider'];

export default function FormBuilderPage() {
  const { formId } = useParams<{ formId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const isNew = !formId || formId === 'new';
  const returnTo = searchParams.get('returnTo') || '/admin';

  const [loading, setLoading] = useState(true);
  const [initialFields, setInitialFields] = useState<FormField[]>([]);
  const [fieldTypes, setFieldTypes] = useState<UiFieldType[]>([]);
  const [formName, setFormName] = useState(searchParams.get('name') || 'Untitled Form');
  const [formType, setFormType] = useState(searchParams.get('type') || 'requests');
  const [formDescription, setFormDescription] = useState(searchParams.get('description') || '');
  const [numericFormId, setNumericFormId] = useState<number | null>(isNew ? null : Number(formId));

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // Load field types
        const types = await fieldTypeService.getUiFieldTypes();
        setFieldTypes(types);

        // If editing, load existing form + fields
        if (!isNew && formId) {
          const data = await formService.getFormById(Number(formId));
          setFormName(data.form.FORM_NAME);
          setFormDescription(data.form.FORM_DESCRIPTION || '');
          const converted = formService.convertDbFieldsToFormFields(data.fields);
          setInitialFields(converted);
        }
      } catch (error) {
        console.error('Error loading form builder data:', error);
        toast.error('Failed to load form data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [formId, isNew]);

  const handleSave = async (data: {
    name: string;
    description: string;
    type: string;
    fields: FormField[];
  }) => {
    // Filter out layout-only fields before saving
    const savableFields = data.fields.filter(
      (f) => !LAYOUT_TYPES.includes(f.fieldType)
    );

    const dbForm: DbForm = {
      FORM_NAME: data.name,
      FORM_DESCRIPTION: data.description,
      IS_PUBLIC: false,
      IS_ACTIVE: true,
      IS_DELETED: false,
    };

    const dbFields = formService.convertFormFieldsToDbFields(savableFields);

    if (numericFormId) {
      // Update existing
      await formService.updateForm(numericFormId, dbForm, dbFields);
      toast.success('Form updated successfully');
    } else {
      // Create new
      const result = await formService.createForm(dbForm, dbFields);
      if (result.form.FORM_ID) {
        setNumericFormId(result.form.FORM_ID);
      }
      toast.success('Form created successfully');
    }

    navigate(returnTo);
  };

  const handleCancel = () => {
    navigate(returnTo);
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#F3F5F9',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 32, height: 32, border: '4px solid #E4E6EB',
            borderTopColor: '#3B6EF0', borderRadius: '50%',
            animation: 'spin 1s linear infinite', margin: '0 auto 12px',
          }} />
          <p style={{ color: '#6B7280', fontSize: 14 }}>Loading form builder…</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    );
  }

  return (
    <FormBuilder
      initialFields={initialFields}
      fieldTypes={fieldTypes}
      formName={formName}
      formType={formType}
      formDescription={formDescription}
      onSave={handleSave}
      onCancel={handleCancel}
      isEditing={!isNew}
    />
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd "/Users/epena/Desktop/www/projects/Guardian MVP" && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/pages/FormBuilderPage.tsx
git commit -m "feat: add FormBuilderPage with routing, data loading, and save"
```

---

### Task 8: Add Route to App.tsx

**Files:**
- Modify: `src/App.tsx` (lines 37 and 84)

- [ ] **Step 1: Add import**

Add this import after the existing page imports (after line 37, alongside the other page imports):

```tsx
import FormBuilderPage from './pages/FormBuilderPage';
```

- [ ] **Step 2: Add routes**

Add these two routes before the closing `</Routes>` tag (before line 85):

```tsx
            <Route path="/form-builder/new" element={<ProtectedRoute><FormBuilderPage /></ProtectedRoute>} />
            <Route path="/form-builder/:formId" element={<ProtectedRoute><FormBuilderPage /></ProtectedRoute>} />
```

- [ ] **Step 3: Verify it compiles**

Run: `cd "/Users/epena/Desktop/www/projects/Guardian MVP" && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add /form-builder routes to App.tsx"
```

---

### Task 9: Simplify CustomWorkflowTemplateModal

**Files:**
- Modify: `src/components/CustomWorkflowTemplateModal.tsx`

- [ ] **Step 1: Add useNavigate import**

Add `useNavigate` to the react-router-dom import. Find the existing imports at the top of the file and add:

```tsx
import { useNavigate } from 'react-router-dom';
```

- [ ] **Step 2: Add navigate hook and remove unused state/functions**

Inside the component, right after the opening, add:

```tsx
  const navigate = useNavigate();
```

Remove these state variables (they are no longer needed):
- `showFieldBuilder`
- `formFields`

Remove these functions entirely:
- `handleFormFieldsChange`
- `handleSaveEditedTemplate`
- `handleCreateTemplate`

Remove the `SimpleFormBuilder` import at the top of the file.

Remove from the `resetModalState` function: `setShowFieldBuilder(false)` and `setFormFields([])`.

Remove from the `handleCancel` function: `setShowFieldBuilder(false)` and `setFormFields([])`.

- [ ] **Step 3: Simplify handleEditTemplate**

Replace the entire `handleEditTemplate` function with:

```tsx
  const handleEditTemplate = (template: CustomWorkflowTemplate) => {
    handleModalClose();
    navigate(`/form-builder/${template.FORM_ID}?returnTo=/admin`);
  };
```

- [ ] **Step 4: Update the "Continue to Field Builder" button**

In the create form section, replace the "Continue to Field Builder" button's `onClick` handler. Find the button with text `Continue to Field Builder` and replace its `onClick`:

```tsx
                    <button 
                      className={`flex items-center justify-center px-4 py-2 text-sm font-medium text-white rounded-lg transition-all duration-200 ${
                        formData.name.trim() 
                          ? 'bg-green-600 hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2' 
                          : 'bg-gray-400 cursor-not-allowed'
                      }`}
                      onClick={() => {
                        if (!formData.name.trim()) {
                          toast.error('Template name is required');
                          return;
                        }
                        handleModalClose();
                        navigate(`/form-builder/new?name=${encodeURIComponent(formData.name.trim())}&type=${encodeURIComponent(formData.formType)}&description=${encodeURIComponent(formData.description.trim())}&returnTo=/admin`);
                      }}
                      disabled={!formData.name.trim()}
                    >
                      <FaWrench className="mr-2" />
                      Continue to Field Builder
                    </button>
```

- [ ] **Step 5: Replace confirm() with GuardianSweetAlert in handleDeleteTemplate**

Replace the `if (!confirm(...))` call with:

```tsx
  const handleDeleteTemplate = async (templateId: number, templateName: string) => {
    const confirmed = await GuardianSweetAlert.showConfirmation(
      'Delete Template',
      `Are you sure you want to delete the custom template "${templateName}"? This action cannot be undone.`,
      { confirmText: 'Delete', cancelText: 'Cancel', severity: 'medium', dangerousAction: true }
    );
    if (!confirmed) return;
    // ... rest of the function stays the same
```

Add the import at the top if not already present:

```tsx
import { GuardianSweetAlert } from '../utils/sweetAlert';
```

- [ ] **Step 6: Remove the entire field builder view**

Remove the entire `showFieldBuilder ? (...)` conditional block from the return JSX. The modal should only ever show the template list view. The return JSX structure becomes:

```tsx
    <Modal 
      isOpen={isOpen} 
      onClose={handleModalClose} 
      title="Custom Workflow Templates" 
      size="xl"
    >
      <div className="min-h-[70vh] bg-gray-50">
        {/* Only the template list view — no field builder */}
        <div className="h-full">
          {/* ... existing template list JSX stays exactly as-is ... */}
        </div>
      </div>
    </Modal>
```

- [ ] **Step 7: Verify it compiles**

Run: `cd "/Users/epena/Desktop/www/projects/Guardian MVP" && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 8: Commit**

```bash
git add src/components/CustomWorkflowTemplateModal.tsx
git commit -m "refactor: simplify CustomWorkflowTemplateModal to navigate to form builder page"
```

---

### Task 10: Manual Smoke Test

**Files:** None (testing only)

- [ ] **Step 1: Start dev servers**

Terminal 1:
```bash
cd "/Users/epena/Desktop/www/projects/Guardian MVP"
DATABASE_URL="postgresql://USER:PASSWORD@HOST/netlifydb?schema=GUARDIAN&connection_limit=30&pool_timeout=20" bun server.cjs
```

Terminal 2:
```bash
cd "/Users/epena/Desktop/www/projects/Guardian MVP"
bun run dev
```

- [ ] **Step 2: Test direct navigation**

Open browser to `http://localhost:5175/form-builder/new`

Verify:
- Three-panel layout renders (left palette, center canvas, right properties)
- Toolbar shows with view toggle, undo, clear, cancel, save buttons
- Clicking a field type in the palette adds it to the canvas
- Dragging a palette item to a drop zone inserts it at that position
- Clicking a canvas card selects it and shows properties in the right panel
- Editing label/placeholder/required in properties updates the card
- Preview mode shows the form as end users would see it
- Code view shows JSON schema with copy button
- Undo works after adding/removing fields
- Cancel navigates back

- [ ] **Step 3: Test from CustomWorkflowTemplateModal**

Navigate to `/admin`, open the Custom Workflow Templates modal:
- "Create New Template" shows the metadata form
- Fill in name, click "Continue to Field Builder" — navigates to `/form-builder/new?name=...`
- Click "Edit Fields" on an existing template — navigates to `/form-builder/:id`
- Delete uses GuardianSweetAlert instead of browser `confirm()`

- [ ] **Step 4: Test save flow**

On `/form-builder/new`:
- Add several fields, set some as required, add options to a dropdown
- Click Save — verify toast shows "Form created successfully"
- Verify redirect to `/admin`
- Open the template modal and confirm the new template appears

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete form builder upgrade — three-panel page with DnD, preview, and code views"
```
