# Form Export Feature Implementation Guide

## Overview

Implement a form data export feature that allows Guardian application users to export completed form submissions for review, analysis, and retention outside the system. The export is triggered from the form template view and generates downloadable files containing all form data, metadata, and related system information.

## Reference Prototype

See `subject-workup-export.html` for the complete UI/UX design reference. This prototype demonstrates the export interface, data preview, format selection, and download flow.

---

## Acceptance Criteria

- [ ] The system shall provide an export option for completed forms
- [ ] The system shall export all data entered into the form
- [ ] The exported data shall accurately reflect the form submission at the time of export
- [ ] The system shall initiate the export upon user request
- [ ] The system shall include associated metadata (e.g., submission date, status, submitter)
- [ ] The system shall include related system-generated data linked to the form
- [ ] Relationships between form data elements shall be preserved in the export
- [ ] The system shall support export in approved formats (e.g., CSV)
- [ ] The exported file shall conform to the selected format specification

---

## Implementation Tasks

### 1. Database Queries

Create queries to gather all export data from these tables:

```sql
-- Form instance and submission data
SELECT 
    fi.ID as form_instance_id,
    fi.FORM_ID,
    fi.STATUS,
    fi.CREATED_DATE as submission_date,
    fi.MODIFIED_DATE as last_modified,
    fi.CREATED_BY as submitter_id,
    u.FULL_NAME as submitter_name,
    f.NAME as form_name,
    f.FORM_TYPE
FROM GUARDIAN.FORMS_INSTANCE fi
JOIN GUARDIAN.USERS u ON fi.CREATED_BY = u.ID
JOIN GUARDIAN.FORMS f ON fi.FORM_ID = f.ID
WHERE fi.ID = @formInstanceId
AND fi.COMPANY_ID = @companyId;

-- Form field values
SELECT 
    fiv.FIELD_ID,
    fld.NAME as field_name,
    fld.LABEL as field_label,
    fiv.VALUE,
    fld.FIELD_TYPE_ID,
    ft.NAME as field_type,
    fld.REQUIRED,
    fiv.CREATED_DATE,
    fiv.MODIFIED_DATE
FROM GUARDIAN.FORMS_INSTANCE_VALUES fiv
JOIN GUARDIAN.FIELDS fld ON fiv.FIELD_ID = fld.ID
JOIN GUARDIAN.FIELD_TYPE ft ON fld.FIELD_TYPE_ID = ft.ID
WHERE fiv.FORM_INSTANCE_ID = @formInstanceId
ORDER BY fld.SORT_ORDER;

-- Related attachments
SELECT 
    a.ID,
    a.FILE_NAME,
    a.FILE_SIZE,
    a.MIME_TYPE,
    a.CREATED_DATE
FROM GUARDIAN.ATTACHMENTS a
WHERE a.FORM_INSTANCE_ID = @formInstanceId;

-- Related tasks
SELECT 
    t.ID,
    t.TRACKING_ID,
    t.DESCRIPTION,
    t.STATUS,
    t.ASSIGNED_TO,
    u.FULL_NAME as assigned_to_name,
    t.CREATED_DATE,
    t.COMPLETED_DATE
FROM GUARDIAN.TASKS t
LEFT JOIN GUARDIAN.USERS u ON t.ASSIGNED_TO = u.ID
WHERE t.REQUEST_ID = @requestId;

-- Audit trail / notifications
SELECT 
    n.ID,
    n.MESSAGE,
    n.CREATED_DATE,
    n.READ_DATE
FROM GUARDIAN.NOTIFICATIONS n
WHERE n.RELATED_FORM_INSTANCE_ID = @formInstanceId
ORDER BY n.CREATED_DATE;
```

### 2. Backend API Endpoints

Add to `server.cjs`, `server.js`, and `server-production.js`:

```javascript
// GET /api/forms/:formInstanceId/export-preview
// Returns all form data for preview before export
app.get('/api/forms/:formInstanceId/export-preview', authenticateToken, async (req, res) => {
    try {
        const { formInstanceId } = req.params;
        const companyId = req.companyId;
        
        // Verify form instance belongs to user's company
        const formInstance = await getFormInstance(formInstanceId, companyId);
        if (!formInstance) {
            return res.status(404).json({ error: 'Form instance not found' });
        }
        
        // Gather all export data
        const exportData = {
            metadata: {
                formInstanceId: formInstance.ID,
                formName: formInstance.FORM_NAME,
                caseNumber: formInstance.CASE_NUMBER,
                submissionDate: formInstance.CREATED_DATE,
                submittedBy: formInstance.SUBMITTER_NAME,
                status: formInstance.STATUS,
                lastModified: formInstance.MODIFIED_DATE
            },
            fields: await getFormFieldValues(formInstanceId),
            attachments: await getAttachments(formInstanceId),
            tasks: await getRelatedTasks(formInstance.REQUEST_ID),
            auditTrail: await getAuditTrail(formInstanceId)
        };
        
        res.json(exportData);
    } catch (error) {
        console.error('Export preview error:', error);
        res.status(500).json({ error: 'Failed to generate export preview' });
    }
});

// POST /api/forms/:formInstanceId/export
// Generates and returns the export file
app.post('/api/forms/:formInstanceId/export', authenticateToken, async (req, res) => {
    try {
        const { formInstanceId } = req.params;
        const { format } = req.body; // 'csv', 'json', or 'pdf'
        const companyId = req.companyId;
        
        // Verify access
        const formInstance = await getFormInstance(formInstanceId, companyId);
        if (!formInstance) {
            return res.status(404).json({ error: 'Form instance not found' });
        }
        
        // Gather export data
        const exportData = await gatherExportData(formInstanceId);
        
        // Generate file based on format
        let fileContent, mimeType, fileExtension;
        
        switch (format) {
            case 'csv':
                fileContent = generateCSV(exportData);
                mimeType = 'text/csv';
                fileExtension = 'csv';
                break;
            case 'json':
                fileContent = JSON.stringify(exportData, null, 2);
                mimeType = 'application/json';
                fileExtension = 'json';
                break;
            case 'pdf':
                fileContent = await generatePDF(exportData);
                mimeType = 'application/pdf';
                fileExtension = 'pdf';
                break;
            default:
                return res.status(400).json({ error: 'Invalid format' });
        }
        
        // Generate filename
        const filename = `${formInstance.CASE_NUMBER}_${formInstance.FORM_NAME.replace(/\s+/g, '-').toLowerCase()}_${new Date().toISOString().split('T')[0]}.${fileExtension}`;
        
        // Set headers and send file
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(fileContent);
        
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Failed to generate export' });
    }
});
```

### 3. CSV Generation Function

```javascript
function generateCSV(exportData) {
    const lines = [];
    
    // Header section
    lines.push(`"Form Export - ${exportData.metadata.formName}"`);
    lines.push(`"Case Number","${exportData.metadata.caseNumber}"`);
    lines.push(`"Export Date","${new Date().toISOString()}"`);
    lines.push('');
    
    // Metadata section
    lines.push('"METADATA"');
    lines.push('"Field","Value"');
    lines.push(`"Submission Date","${exportData.metadata.submissionDate}"`);
    lines.push(`"Submitted By","${exportData.metadata.submittedBy}"`);
    lines.push(`"Form Status","${exportData.metadata.status}"`);
    lines.push(`"Last Modified","${exportData.metadata.lastModified}"`);
    lines.push('');
    
    // Group fields by section
    const sections = groupFieldsBySection(exportData.fields);
    
    for (const [sectionName, fields] of Object.entries(sections)) {
        lines.push(`"${sectionName.toUpperCase()}"`);
        lines.push('"Field","Value"');
        
        for (const field of fields) {
            const escapedValue = escapeCSVValue(field.value);
            lines.push(`"${field.label}","${escapedValue}"`);
        }
        lines.push('');
    }
    
    // Related data section
    lines.push('"RELATED SYSTEM DATA"');
    lines.push('"Field","Value"');
    lines.push(`"Form Instance ID","${exportData.metadata.formInstanceId}"`);
    lines.push(`"Attachments","${exportData.attachments.length} files"`);
    lines.push(`"Tasks","${exportData.tasks.length} tasks"`);
    lines.push(`"Audit Trail Entries","${exportData.auditTrail.length}"`);
    
    return lines.join('\n');
}

function escapeCSVValue(value) {
    if (value === null || value === undefined) return '';
    const stringValue = String(value);
    // Escape quotes and wrap in quotes if contains comma, newline, or quote
    if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
        return stringValue.replace(/"/g, '""');
    }
    return stringValue;
}

function groupFieldsBySection(fields) {
    const sections = {};
    for (const field of fields) {
        const section = field.section || 'General';
        if (!sections[section]) {
            sections[section] = [];
        }
        sections[section].push(field);
    }
    return sections;
}
```

### 4. Frontend Components

#### ExportFormModal.tsx

Create new component at `src/components/ExportFormModal.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import { Modal, Button, Spinner, Alert } from 'react-bootstrap';

interface ExportFormModalProps {
    show: boolean;
    onHide: () => void;
    formInstanceId: number;
    formName: string;
    caseNumber: string;
}

type ExportFormat = 'csv' | 'json' | 'pdf';

interface ExportPreviewData {
    metadata: {
        formInstanceId: number;
        formName: string;
        caseNumber: string;
        submissionDate: string;
        submittedBy: string;
        status: string;
        lastModified: string;
    };
    fields: Array<{
        fieldId: number;
        label: string;
        value: string;
        section: string;
        fieldType: string;
    }>;
    attachments: Array<{ id: number; fileName: string; fileSize: number }>;
    tasks: Array<{ id: number; trackingId: string; status: string }>;
    auditTrail: Array<{ id: number; message: string; createdDate: string }>;
}

export const ExportFormModal: React.FC<ExportFormModalProps> = ({
    show,
    onHide,
    formInstanceId,
    formName,
    caseNumber
}) => {
    const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('csv');
    const [previewData, setPreviewData] = useState<ExportPreviewData | null>(null);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (show && formInstanceId) {
            loadPreviewData();
        }
    }, [show, formInstanceId]);

    const loadPreviewData = async () => {
        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/forms/${formInstanceId}/export-preview`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) throw new Error('Failed to load preview');
            
            const data = await response.json();
            setPreviewData(data);
        } catch (err) {
            setError('Failed to load export preview');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async () => {
        setExporting(true);
        setError(null);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/forms/${formInstanceId}/export`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ format: selectedFormat })
            });
            
            if (!response.ok) throw new Error('Export failed');
            
            // Get filename from Content-Disposition header
            const contentDisposition = response.headers.get('Content-Disposition');
            const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
            const filename = filenameMatch ? filenameMatch[1] : `export.${selectedFormat}`;
            
            // Download the file
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            onHide();
        } catch (err) {
            setError('Failed to export form data');
            console.error(err);
        } finally {
            setExporting(false);
        }
    };

    const formatOptions = [
        { value: 'csv', label: 'CSV', description: 'Spreadsheet-compatible format for Excel/Sheets' },
        { value: 'json', label: 'JSON', description: 'Structured data with preserved relationships' },
        { value: 'pdf', label: 'PDF', description: 'Formatted report for archival/printing' }
    ];

    return (
        <Modal show={show} onHide={onHide} size="lg" centered>
            <Modal.Header closeButton className="bg-light">
                <Modal.Title>
                    <i className="bi bi-download me-2"></i>
                    Export Form Data
                </Modal.Title>
            </Modal.Header>
            
            <Modal.Body>
                {error && <Alert variant="danger">{error}</Alert>}
                
                {loading ? (
                    <div className="text-center py-5">
                        <Spinner animation="border" />
                        <p className="mt-3">Loading export preview...</p>
                    </div>
                ) : previewData && (
                    <>
                        {/* Metadata Summary */}
                        <div className="bg-success bg-opacity-10 border border-success rounded p-3 mb-4">
                            <div className="row">
                                <div className="col-md-4">
                                    <small className="text-success fw-bold">CASE NUMBER</small>
                                    <div>{previewData.metadata.caseNumber}</div>
                                </div>
                                <div className="col-md-4">
                                    <small className="text-success fw-bold">SUBMITTED BY</small>
                                    <div>{previewData.metadata.submittedBy}</div>
                                </div>
                                <div className="col-md-4">
                                    <small className="text-success fw-bold">STATUS</small>
                                    <div>{previewData.metadata.status}</div>
                                </div>
                            </div>
                        </div>
                        
                        {/* Format Selection */}
                        <h6 className="mb-3">Select Export Format</h6>
                        <div className="row mb-4">
                            {formatOptions.map(format => (
                                <div className="col-md-4" key={format.value}>
                                    <div 
                                        className={`border rounded p-3 cursor-pointer ${
                                            selectedFormat === format.value 
                                                ? 'border-primary bg-primary bg-opacity-10' 
                                                : ''
                                        }`}
                                        onClick={() => setSelectedFormat(format.value as ExportFormat)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <div className="d-flex justify-content-between align-items-center">
                                            <strong>{format.label}</strong>
                                            {selectedFormat === format.value && (
                                                <i className="bi bi-check-circle-fill text-primary"></i>
                                            )}
                                        </div>
                                        <small className="text-muted">{format.description}</small>
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        {/* Export Summary */}
                        <div className="bg-light rounded p-3">
                            <h6 className="mb-2">Export Summary</h6>
                            <div className="row text-muted small">
                                <div className="col-md-3">
                                    <strong>{previewData.fields.length}</strong> Fields
                                </div>
                                <div className="col-md-3">
                                    <strong>{previewData.attachments.length}</strong> Attachments
                                </div>
                                <div className="col-md-3">
                                    <strong>{previewData.tasks.length}</strong> Tasks
                                </div>
                                <div className="col-md-3">
                                    <strong>{previewData.auditTrail.length}</strong> Audit Entries
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </Modal.Body>
            
            <Modal.Footer>
                <Button variant="outline-secondary" onClick={onHide}>
                    Cancel
                </Button>
                <Button 
                    variant="primary" 
                    onClick={handleExport}
                    disabled={loading || exporting || !previewData}
                >
                    {exporting ? (
                        <>
                            <Spinner size="sm" className="me-2" />
                            Exporting...
                        </>
                    ) : (
                        <>
                            <i className="bi bi-download me-2"></i>
                            Export {selectedFormat.toUpperCase()}
                        </>
                    )}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};
```

### 5. Integration Points

Add export button to existing form view components:

```typescript
// In FormDetails.tsx or similar component
import { ExportFormModal } from './ExportFormModal';

// Add state
const [showExportModal, setShowExportModal] = useState(false);

// Add button in toolbar/header
<Button 
    variant="outline-primary" 
    onClick={() => setShowExportModal(true)}
    title="Export Form Data"
>
    <i className="bi bi-download me-1"></i>
    Export
</Button>

// Add modal
<ExportFormModal
    show={showExportModal}
    onHide={() => setShowExportModal(false)}
    formInstanceId={currentFormInstance.id}
    formName={currentFormInstance.formName}
    caseNumber={currentFormInstance.caseNumber}
/>
```

### 6. PDF Generation (Optional Enhancement)

For PDF export, install and use `pdfkit` or `puppeteer`:

```bash
bun add pdfkit
```

```javascript
const PDFDocument = require('pdfkit');

async function generatePDF(exportData) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument();
        const chunks = [];
        
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
        
        // Header
        doc.fontSize(20).text(exportData.metadata.formName, { align: 'center' });
        doc.fontSize(12).text(`Case #: ${exportData.metadata.caseNumber}`, { align: 'center' });
        doc.moveDown();
        
        // Metadata
        doc.fontSize(14).text('Submission Details', { underline: true });
        doc.fontSize(10);
        doc.text(`Submitted: ${exportData.metadata.submissionDate}`);
        doc.text(`By: ${exportData.metadata.submittedBy}`);
        doc.text(`Status: ${exportData.metadata.status}`);
        doc.moveDown();
        
        // Fields by section
        const sections = groupFieldsBySection(exportData.fields);
        for (const [sectionName, fields] of Object.entries(sections)) {
            doc.fontSize(14).text(sectionName, { underline: true });
            doc.fontSize(10);
            for (const field of fields) {
                doc.text(`${field.label}: ${field.value || 'N/A'}`);
            }
            doc.moveDown();
        }
        
        doc.end();
    });
}
```

---

## Testing Checklist

- [ ] Export preview loads all form data correctly
- [ ] CSV export generates valid CSV format
- [ ] JSON export preserves data structure and relationships
- [ ] PDF export generates readable document (if implemented)
- [ ] Export respects company isolation (users can only export their company's forms)
- [ ] Large forms export without timeout
- [ ] Special characters are properly escaped in CSV
- [ ] File downloads correctly in all browsers
- [ ] Error handling displays user-friendly messages
- [ ] Loading states display during export generation

---

## Security Considerations

1. **Company Isolation**: All queries MUST filter by `COMPANY_ID` from JWT token
2. **Authentication**: Export endpoints require valid JWT token
3. **Data Sanitization**: Escape special characters in CSV output
4. **Audit Logging**: Log all export actions for compliance
5. **Rate Limiting**: Consider limiting export frequency to prevent abuse

---

## Multi-Server Synchronization

**CRITICAL**: When implementing, update ALL THREE server files:
1. `server.cjs` (development)
2. `server-production.js` (production source)
3. `server.js` (local production testing)

Use the `api-specialist` agent to ensure synchronization.

---

## Dependencies

```bash
# For PDF generation (optional)
bun add pdfkit

# Already available
# - express (API routes)
# - prisma (database queries)
# - jsonwebtoken (authentication)
```

---

## File Naming Convention

Export filenames follow this pattern:
```
{CASE_NUMBER}_{form-name}_{YYYY-MM-DD}.{extension}
```

Example: `SW-2026-0142_subject-workup_2026-03-31.csv`
