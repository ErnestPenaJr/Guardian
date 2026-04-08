import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  Shield,
  ArrowLeft,
  Download,
  FileText,
  CheckSquare,
  Clock,
  Users,
  Folder,
  Eye,
  CheckCircle,
} from 'lucide-react';
import { exportConfigs, ExportSection } from '../config/exportConfig';
import {
  generateCSV,
  generateJSON,
  downloadFile,
  triggerPDFExport,
  getExportFilename,
  estimateFileSize,
  formatFieldValue,
  ExportData,
} from '../utils/exportUtils';
import './ExportPage.css';

type ExportFormat = 'csv' | 'json' | 'pdf';

interface ExportPageLocationState {
  data: Record<string, any>[];
  metadata: Record<string, string>;
  title?: string;
  identifier?: string;
  dynamicSections?: ExportSection[];
}

const iconMap: Record<string, React.ReactNode> = {
  'file-text': <FileText size={20} />,
  'check-square': <CheckSquare size={20} />,
  'clock': <Clock size={20} />,
  'users': <Users size={20} />,
  'folder': <Folder size={20} />,
  'search': <FileText size={20} />,
  'map-pin': <FileText size={20} />,
  'phone': <FileText size={20} />,
  'monitor': <FileText size={20} />,
  'activity': <FileText size={20} />,
};

const ExportPage: React.FC = () => {
  const { type } = useParams<{ type: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as ExportPageLocationState | null;

  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('csv');
  const [activePreviewTab, setActivePreviewTab] = useState<'structured' | 'table' | 'raw'>('structured');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [progressWidth, setProgressWidth] = useState(0);
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(new Set());

  const config = type ? exportConfigs[type] : null;

  useEffect(() => {
    if (!state || !state.data || !config) {
      navigate('/', { replace: true });
    }
  }, [state, config, navigate]);

  if (!state || !config) return null;

  const { data, metadata, title, identifier, dynamicSections } = state;
  const sections = dynamicSections || config.sections;

  const exportData: ExportData = {
    type: type!,
    data,
    metadata,
    title,
    identifier,
    dynamicSections,
  };

  const generatedContent = useMemo(() => {
    if (selectedFormat === 'csv') return generateCSV(exportData, config);
    if (selectedFormat === 'json') return generateJSON(exportData, config);
    return '';
  }, [selectedFormat, data, type]);

  const fileSize = useMemo(() => {
    if (generatedContent) return estimateFileSize(generatedContent);
    return '~' + estimateFileSize(generateCSV(exportData, config));
  }, [generatedContent]);

  const filename = getExportFilename(type!, identifier, selectedFormat);

  const handleExportNow = () => {
    if (selectedFormat === 'pdf') {
      triggerPDFExport();
      return;
    }
    setShowSuccessModal(true);
    setTimeout(() => setProgressWidth(100), 100);
  };

  const handleDownload = () => {
    const mimeType = selectedFormat === 'csv' ? 'text/csv' : 'application/json';
    const content = selectedFormat === 'csv'
      ? generateCSV(exportData, config)
      : generateJSON(exportData, config);
    downloadFile(content, filename, mimeType);
    setShowSuccessModal(false);
    setProgressWidth(0);
  };

  const handleCloseModal = () => {
    setShowSuccessModal(false);
    setProgressWidth(0);
  };

  const toggleSection = (index: number) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handlePreviewExport = () => {
    const tabMap: Record<ExportFormat, 'table' | 'raw' | 'structured'> = {
      csv: 'table',
      json: 'raw',
      pdf: 'structured',
    };
    setActivePreviewTab(tabMap[selectedFormat]);
  };

  const pageTitle = title || config.pageTitle;

  return (
    <div className="export-page">
      <header className="export-header">
        <h1>
          <Shield size={28} />
          Guardian - {pageTitle}
        </h1>
        <div className="export-header-actions">
          <button className="export-btn export-btn-secondary" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} />
            Back
          </button>
        </div>
      </header>

      <main className="export-main-content">
        <div className="export-panel">
          <div className="export-panel-header">
            <h2>
              <Download size={20} />
              {pageTitle}
            </h2>
            {identifier && (
              <span className="export-format-badge">
                {identifier}
              </span>
            )}
          </div>

          <div className="export-panel-body">
            <div className="export-metadata-grid">
              {config.metadataFields.map((field) => (
                <div key={field.key} className="export-metadata-item">
                  <span className="export-metadata-label">{field.label}</span>
                  <span className="export-metadata-value">
                    {metadata[field.key] || 'N/A'}
                  </span>
                </div>
              ))}
            </div>

            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a2e', marginBottom: '16px' }}>
              Select Export Format
            </h3>
            <div className="export-options">
              <div
                className={`export-option ${selectedFormat === 'csv' ? 'selected' : ''}`}
                onClick={() => setSelectedFormat('csv')}
              >
                <h3>
                  <FileText size={20} />
                  CSV Export
                  <span className="export-format-badge">.csv</span>
                </h3>
                <p>Spreadsheet-compatible format. Best for data analysis in Excel, Google Sheets, or database import.</p>
              </div>
              <div
                className={`export-option ${selectedFormat === 'json' ? 'selected' : ''}`}
                onClick={() => setSelectedFormat('json')}
              >
                <h3>
                  <FileText size={20} />
                  JSON Export
                  <span className="export-format-badge">.json</span>
                </h3>
                <p>Structured data format. Preserves all relationships and nested data. Ideal for system integration.</p>
              </div>
              <div
                className={`export-option ${selectedFormat === 'pdf' ? 'selected' : ''}`}
                onClick={() => setSelectedFormat('pdf')}
              >
                <h3>
                  <FileText size={20} />
                  PDF Report
                  <span className="export-format-badge">.pdf</span>
                </h3>
                <p>Formatted printable report. Best for archival, sharing, and official documentation purposes.</p>
              </div>
            </div>

            {data.length > 0 ? (
              <div className="export-data-preview">
                <div className="export-preview-header">
                  <span>Data Preview</span>
                  <span style={{ fontWeight: 400, opacity: 0.8 }}>
                    {data.length} records &bull; {sections.length || 1} sections
                  </span>
                </div>

                <div className="export-preview-tabs">
                  <button
                    className={`export-preview-tab ${activePreviewTab === 'structured' ? 'active' : ''}`}
                    onClick={() => setActivePreviewTab('structured')}
                  >
                    Structured View
                  </button>
                  <button
                    className={`export-preview-tab ${activePreviewTab === 'table' ? 'active' : ''}`}
                    onClick={() => setActivePreviewTab('table')}
                  >
                    Table View
                  </button>
                  <button
                    className={`export-preview-tab ${activePreviewTab === 'raw' ? 'active' : ''}`}
                    onClick={() => setActivePreviewTab('raw')}
                  >
                    Raw Data
                  </button>
                </div>

                {activePreviewTab === 'structured' && (
                  <div className="export-preview-content">
                    {sections.length > 0 ? (
                      sections.map((section, sIdx) => (
                        <div key={sIdx} className="export-data-section">
                          <button
                            className="export-section-header"
                            onClick={() => toggleSection(sIdx)}
                          >
                            {iconMap[section.iconType] || <FileText size={16} />}
                            {section.title}
                            <span style={{ marginLeft: 'auto', fontWeight: 400, color: '#64748b' }}>
                              {section.fields.length} fields
                            </span>
                          </button>
                          {!collapsedSections.has(sIdx) && (
                            <div className="export-section-content">
                              {data.map((row, rIdx) => (
                                <React.Fragment key={rIdx}>
                                  {data.length > 1 && (
                                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#0d4f4f', padding: '4px 0', borderBottom: '1px solid #e2e8f0', marginBottom: '8px' }}>
                                      Record {rIdx + 1}
                                    </div>
                                  )}
                                  {section.fields.map((field) => {
                                    const value = formatFieldValue(
                                      field.key.includes('.')
                                        ? field.key.split('.').reduce((acc: any, part: string) => acc?.[part], row)
                                        : row[field.key]
                                    );
                                    return (
                                      <div key={field.key} className="export-data-row">
                                        <span className="export-data-label">{field.label}</span>
                                        <span className={`export-data-value ${value === 'Not provided' ? 'empty' : ''}`}>
                                          {value}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </React.Fragment>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="export-section-content">
                        {data.map((row, rIdx) => (
                          <React.Fragment key={rIdx}>
                            {config.tableColumns.map((col) => (
                              <div key={col.key} className="export-data-row">
                                <span className="export-data-label">{col.header}</span>
                                <span className={`export-data-value ${!row[col.key] ? 'empty' : ''}`}>
                                  {formatFieldValue(row[col.key])}
                                </span>
                              </div>
                            ))}
                            {rIdx < data.length - 1 && <hr style={{ margin: '12px 0', borderColor: '#e2e8f0' }} />}
                          </React.Fragment>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activePreviewTab === 'table' && (
                  <div className="export-preview-content export-csv-preview">
                    <table>
                      <thead>
                        <tr>
                          {config.tableColumns.map((col) => (
                            <th key={col.key}>{col.header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.map((row, idx) => (
                          <tr key={idx}>
                            {config.tableColumns.map((col) => (
                              <td key={col.key}>{formatFieldValue(row[col.key])}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {activePreviewTab === 'raw' && (
                  <div className="export-preview-content">
                    <pre className="export-raw-data">
                      {generateJSON(exportData, config)}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="export-empty-state">
                <h3>No records to export</h3>
                <p>There is no data available for export. Go back and try with different filters.</p>
              </div>
            )}

            {data.length > 0 && (
              <div className="export-actions-footer">
                <div className="export-info">
                  <strong>{data.length} records</strong> will be exported across{' '}
                  <strong>{sections.length || 1} sections</strong>
                  <br />
                  Including metadata and all visible data fields
                </div>
                <div className="export-action-buttons">
                  <button className="export-btn export-btn-outline" onClick={handlePreviewExport}>
                    <Eye size={16} />
                    Preview Export
                  </button>
                  <button className="export-btn export-btn-primary" onClick={handleExportNow}>
                    <Download size={16} />
                    Export Now
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {showSuccessModal && (
        <div className="export-modal-overlay" onClick={handleCloseModal}>
          <div className="export-modal" onClick={(e) => e.stopPropagation()}>
            <div className="export-modal-icon">
              <CheckCircle size={32} color="#059669" />
            </div>
            <h3>Export Complete!</h3>
            <p>Your data has been successfully exported and is ready for download.</p>

            <div className="export-progress-bar">
              <div
                className="export-progress-fill"
                style={{ width: `${progressWidth}%` }}
              />
            </div>

            <div className="export-download-info">
              <div className="filename">{filename}</div>
              <div className="filesize">File size: {fileSize}</div>
            </div>

            <button
              className="export-btn export-btn-primary"
              style={{ width: '100%', marginBottom: '12px', justifyContent: 'center' }}
              onClick={handleDownload}
            >
              <Download size={16} />
              Download File
            </button>
            <button
              className="export-btn export-btn-outline"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={handleCloseModal}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExportPage;
