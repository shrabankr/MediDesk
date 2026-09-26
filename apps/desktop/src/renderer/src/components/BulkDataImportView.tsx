import React, { useState, useEffect, useMemo } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle,
  AlertTriangle,
  XCircle,
  AlertCircle,
  Users,
  UserCheck,
  Stethoscope,
  Pill,
  Boxes,
  Truck,
  Barcode,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Layers,
  Sparkles,
  Search,
  Check,
  X,
  Eye,
  ShieldAlert,
  HelpCircle
} from 'lucide-react';
import { Button, Card, Badge } from '@medidesk/ui';
import {
  SessionUser,
  ImportType,
  ImportPolicy,
  ImportTemplateDefinition,
  ImportValidationResult,
  ImportExecutionResult
} from '@medidesk/domain';

interface BulkDataImportViewProps {
  currentUser: SessionUser;
  onNavigate?: (tab: string) => void;
}

export type WizardStep =
  | 'SELECT_TYPE'
  | 'COLUMN_MAPPING'
  | 'VALIDATION_PREVIEW'
  | 'CONFIRMATION'
  | 'RESULT';

export const BulkDataImportView: React.FC<BulkDataImportViewProps> = ({ currentUser, onNavigate }) => {
  const sessionToken = localStorage.getItem('medidesk_session_token') || '';
  const isOwner = currentUser.roles.includes('OWNER');

  // Wizard Steps
  const [step, setStep] = useState<WizardStep>('SELECT_TYPE');

  // Templates
  const [templates, setTemplates] = useState<ImportTemplateDefinition[]>([]);
  const [selectedType, setSelectedType] = useState<ImportType | null>(null);

  // File Upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [rawCsvRows, setRawCsvRows] = useState<Array<Record<string, string>>>([]);

  // Column Mapping
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({}); // targetField -> csvHeader

  // Validation & Policy
  const [policy, setPolicy] = useState<ImportPolicy>('REJECT_ALL_ON_ERROR');
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [validationResult, setValidationResult] = useState<ImportValidationResult | null>(null);
  const [previewTab, setPreviewTab] = useState<'ALL' | 'VALID' | 'WARNING' | 'ERROR'>('ALL');
  const [previewSearch, setPreviewSearch] = useState('');

  // Confirmation Modal
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [ownerConfirmed, setOwnerConfirmed] = useState(false);

  // Execution & Result
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executionProgress, setExecutionProgress] = useState<number>(0);
  const [executionResult, setExecutionResult] = useState<ImportExecutionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch Available Templates
  useEffect(() => {
    const fetchTemplates = async () => {
      if (window.mediDeskBridge?.getImportTemplates) {
        try {
          const res = await window.mediDeskBridge.getImportTemplates(sessionToken);
          if (res.success && res.data) {
            setTemplates(res.data);
          }
        } catch (err: any) {
          setErrorMessage(`Failed to load import templates: ${err.message}`);
        }
      }
    };
    fetchTemplates();
  }, [sessionToken]);

  const selectedTemplateDef = useMemo(() => {
    return templates.find((t) => t.importType === selectedType);
  }, [templates, selectedType]);

  // Handle Template Download
  const handleDownloadTemplate = async (type: ImportType) => {
    if (!window.mediDeskBridge?.downloadImportTemplate) return;
    try {
      const res = await window.mediDeskBridge.downloadImportTemplate(type, sessionToken);
      if (res.success && res.data) {
        const blob = new Blob([res.data.content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', res.data.filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        setErrorMessage(res.error?.message || 'Failed to download template.');
      }
    } catch (err: any) {
      setErrorMessage(`Download error: ${err.message}`);
    }
  };

  // Safe RFC 4180 CSV parser for renderer file reading
  const parseCsvClientSide = (csvText: string): { headers: string[]; rows: Array<Record<string, string>> } => {
    const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim().length > 0);
    if (lines.length === 0) return { headers: [], rows: [] };

    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          result.push(cur.trim());
          cur = '';
        } else {
          cur += char;
        }
      }
      result.push(cur.trim());
      return result;
    };

    const rawHeaders = parseLine(lines[0]);
    // Clean UTF-8 BOM if present
    if (rawHeaders.length > 0 && rawHeaders[0].charCodeAt(0) === 0xfeff) {
      rawHeaders[0] = rawHeaders[0].substring(1);
    }
    const headers = rawHeaders.map((h) => h.trim());

    const rows: Array<Record<string, string>> = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseLine(lines[i]);
      const row: Record<string, string> = {};
      for (let j = 0; j < headers.length; j++) {
        row[headers[j]] = cols[j] || '';
      }
      rows.push(row);
    }

    return { headers, rows };
  };

  // Handle File Drop / Select
  const handleFileSelected = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setErrorMessage('Please upload a valid .csv spreadsheet file.');
      return;
    }

    setSelectedFile(file);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const parsed = parseCsvClientSide(content);
      setCsvHeaders(parsed.headers);
      setRawCsvRows(parsed.rows);

      // Auto-map columns if template definition is available
      if (selectedTemplateDef) {
        const initialMapping: Record<string, string> = {};
        for (const targetCol of selectedTemplateDef.columns) {
          const match = parsed.headers.find(
            (h) =>
              h.toLowerCase().trim().replace(/[\s_-]/g, '') ===
              targetCol.name.toLowerCase().trim().replace(/[\s_-]/g, '')
          );
          if (match) {
            initialMapping[targetCol.name] = match;
          }
        }
        setColumnMapping(initialMapping);
      }

      setStep('COLUMN_MAPPING');
    };
    reader.readAsText(file);
  };

  const handleAutoMapColumns = () => {
    if (!selectedTemplateDef) return;
    const newMapping: Record<string, string> = {};
    for (const targetCol of selectedTemplateDef.columns) {
      const normalizedTarget = targetCol.name.toLowerCase().replace(/[\s_-]/g, '');
      const match = csvHeaders.find((h) => {
        const normalizedCsv = h.toLowerCase().replace(/[\s_-]/g, '');
        return normalizedCsv === normalizedTarget || normalizedCsv.includes(normalizedTarget) || normalizedTarget.includes(normalizedCsv);
      });
      if (match) {
        newMapping[targetCol.name] = match;
      }
    }
    setColumnMapping(newMapping);
  };

  // Reconstruct remapped CSV content and run validation
  const handleProceedToValidation = async () => {
    if (!selectedType || !selectedFile || !selectedTemplateDef) return;

    // Check required fields mapping
    const missingRequired = selectedTemplateDef.columns.filter((c) => c.required && !columnMapping[c.name]);
    if (missingRequired.length > 0) {
      setErrorMessage(
        `Please map required fields: ${missingRequired.map((c) => c.name).join(', ')}`
      );
      return;
    }

    // Reconstruct CSV with mapped target column names
    const targetHeaders = selectedTemplateDef.columns.map((c) => c.name);
    const remappedRows = rawCsvRows.map((rawRow) => {
      const mappedRow: Record<string, string> = {};
      for (const targetName of targetHeaders) {
        const csvHeaderName = columnMapping[targetName];
        mappedRow[targetName] = csvHeaderName ? rawRow[csvHeaderName] || '' : '';
      }
      return mappedRow;
    });

    const headersLine = targetHeaders.join(',');
    const rowsLines = remappedRows.map((r) =>
      targetHeaders.map((h) => `"${(r[h] || '').replace(/"/g, '""')}"`).join(',')
    );
    const reconstructedCsv = [headersLine, ...rowsLines].join('\r\n');

    setIsValidating(true);
    setErrorMessage(null);
    try {
      if (window.mediDeskBridge?.validateImportFile) {
        const res = await window.mediDeskBridge.validateImportFile(
          {
            importType: selectedType,
            fileName: selectedFile.name,
            fileContent: reconstructedCsv,
            organizationId: currentUser.organizationId
          },
          sessionToken
        );

        if (res.success && res.data) {
          setValidationResult(res.data);
          setStep('VALIDATION_PREVIEW');
          // Default policy according to import type & errors
          if (res.data.errorCount > 0 && selectedType !== 'OPENING_STOCK') {
            setPolicy('IMPORT_VALID_ONLY');
          } else {
            setPolicy('REJECT_ALL_ON_ERROR');
          }
        } else {
          setErrorMessage(res.error?.message || 'File validation failed.');
        }
      }
    } catch (err: any) {
      setErrorMessage(`Validation error: ${err.message}`);
    } finally {
      setIsValidating(false);
    }
  };

  // Execute Import inside atomic transaction
  const handleExecuteImport = async () => {
    if (!selectedType || !validationResult || !selectedFile) return;

    // Filter valid rows according to policy
    const rowsToImport = validationResult.rows
      .filter((r) => r.status === 'VALID' || (policy !== 'REJECT_ALL_ON_ERROR' && r.status === 'WARNING'))
      .map((r) => r.rawData);

    if (policy === 'REJECT_ALL_ON_ERROR' && validationResult.errorCount > 0) {
      setErrorMessage('Cannot execute import: errors exist and policy is set to Reject All on Error.');
      return;
    }

    if (rowsToImport.length === 0) {
      setErrorMessage('No valid rows available to import.');
      return;
    }

    setIsExecuting(true);
    setExecutionProgress(20);
    setErrorMessage(null);

    try {
      if (window.mediDeskBridge?.executeImport) {
        setExecutionProgress(50);
        const res = await window.mediDeskBridge.executeImport(
          {
            importType: selectedType,
            fileName: selectedFile.name,
            policy,
            validRows: rowsToImport,
            organizationId: currentUser.organizationId
          },
          sessionToken
        );

        setExecutionProgress(100);
        if (res.success && res.data) {
          setExecutionResult(res.data);
          setIsConfirmModalOpen(false);
          setStep('RESULT');
        } else {
          setErrorMessage(res.error?.message || 'Execution failed.');
        }
      }
    } catch (err: any) {
      setErrorMessage(`Import error: ${err.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  // Export validation errors to CSV
  const handleExportErrorsCsv = () => {
    if (!validationResult) return;
    const errorRows = validationResult.rows.filter((r) => r.status === 'ERROR' || r.status === 'WARNING');
    const csvContent = [
      ['Row Number', 'Status', 'Field', 'Problem Description', 'Suggested Action'].join(','),
      ...errorRows.flatMap((r) =>
        r.problems.map((p) =>
          [r.rowNumber, r.status, `"${p.field}"`, `"${p.message.replace(/"/g, '""')}"`, `"${(p.suggestedFix || '').replace(/"/g, '""')}"`].join(',')
        )
      )
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${selectedType?.toLowerCase()}_import_errors.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleReset = () => {
    setSelectedType(null);
    setSelectedFile(null);
    setCsvHeaders([]);
    setRawCsvRows([]);
    setColumnMapping({});
    setValidationResult(null);
    setExecutionResult(null);
    setErrorMessage(null);
    setStep('SELECT_TYPE');
  };

  const getTypeIcon = (type: ImportType) => {
    switch (type) {
      case 'PATIENTS':
        return <UserCheck className="h-5 w-5 text-blue-600" />;
      case 'DOCTORS':
        return <Stethoscope className="h-5 w-5 text-emerald-600" />;
      case 'USERS':
        return <Users className="h-5 w-5 text-purple-600" />;
      case 'MEDICINES':
        return <Pill className="h-5 w-5 text-indigo-600" />;
      case 'PACKAGING':
        return <Layers className="h-5 w-5 text-teal-600" />;
      case 'SUPPLIERS':
        return <Truck className="h-5 w-5 text-amber-600" />;
      case 'OPENING_STOCK':
        return <Boxes className="h-5 w-5 text-rose-600" />;
      case 'BARCODES':
        return <Barcode className="h-5 w-5 text-cyan-600" />;
      default:
        return <FileSpreadsheet className="h-5 w-5 text-slate-500" />;
    }
  };

  // Filtered rows for preview table
  const filteredPreviewRows = useMemo(() => {
    if (!validationResult) return [];
    return validationResult.rows.filter((r) => {
      if (previewTab === 'VALID' && r.status !== 'VALID') return false;
      if (previewTab === 'WARNING' && r.status !== 'WARNING') return false;
      if (previewTab === 'ERROR' && r.status !== 'ERROR') return false;
      if (previewSearch.trim()) {
        const q = previewSearch.toLowerCase().trim();
        const jsonString = JSON.stringify(r.rawData).toLowerCase();
        return jsonString.includes(q);
      }
      return true;
    });
  }, [validationResult, previewTab, previewSearch]);

  return (
    <div className="space-y-6 pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <UploadCloud className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Bulk Data Import & Onboarding System
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Staged validation, automatic column mapping, and transactional master data onboarding
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {step !== 'SELECT_TYPE' && (
            <Button variant="outline" size="sm" onClick={handleReset} className="flex items-center gap-1.5 text-xs">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Change Type</span>
            </Button>
          )}
          {onNavigate && (
            <Button variant="outline" size="sm" onClick={() => onNavigate('dashboard')} className="text-xs">
              Dashboard
            </Button>
          )}
        </div>
      </div>

      {/* Visual Workflow Steps Bar */}
      <div className="bg-white dark:bg-slate-900 px-6 py-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between max-w-4xl mx-auto text-xs">
          <div className={`flex items-center gap-2 ${step === 'SELECT_TYPE' ? 'font-bold text-blue-600' : 'text-slate-500'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${step === 'SELECT_TYPE' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800'}`}>1</span>
            <span>Select Type & File</span>
          </div>

          <ArrowRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-700" />

          <div className={`flex items-center gap-2 ${step === 'COLUMN_MAPPING' ? 'font-bold text-blue-600' : 'text-slate-500'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${step === 'COLUMN_MAPPING' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800'}`}>2</span>
            <span>Map Columns</span>
          </div>

          <ArrowRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-700" />

          <div className={`flex items-center gap-2 ${step === 'VALIDATION_PREVIEW' ? 'font-bold text-blue-600' : 'text-slate-500'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${step === 'VALIDATION_PREVIEW' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800'}`}>3</span>
            <span>Preview & Policy</span>
          </div>

          <ArrowRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-700" />

          <div className={`flex items-center gap-2 ${step === 'RESULT' ? 'font-bold text-emerald-600' : 'text-slate-500'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${step === 'RESULT' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800'}`}>4</span>
            <span>Result & Audit</span>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
          <span className="flex-1 font-medium">{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="p-1 hover:bg-rose-100 dark:hover:bg-rose-900 rounded font-bold">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ============================================================ */}
      {/* STAGE 1: SELECT IMPORT TYPE & UPLOAD FILE */}
      {/* ============================================================ */}
      {step === 'SELECT_TYPE' && (
        <div className="space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-1">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Choose Record Type to Import</h2>
            <p className="text-xs text-slate-500">
              Each card provides a validated structure, pre-mapped CSV template, and staged safety checks.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((tpl) => {
              const isOpeningStock = tpl.importType === 'OPENING_STOCK';
              return (
                <Card
                  key={tpl.importType}
                  className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                    tpl.isSupported
                      ? 'hover:border-blue-500 hover:shadow-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                      : 'opacity-60 bg-slate-50 dark:bg-slate-900/40 border-dashed border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800">
                          {getTypeIcon(tpl.importType)}
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{tpl.displayName}</h3>
                          <span className="text-[10px] font-mono text-slate-400">{tpl.fileName}</span>
                        </div>
                      </div>
                      {tpl.isSupported ? (
                        isOpeningStock ? (
                          <Badge variant="danger" className="text-[10px]">High Risk</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Ready</Badge>
                        )
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">Disabled</Badge>
                      )}
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                      {tpl.description}
                    </p>

                    {!tpl.isSupported && tpl.unsupportedReason && (
                      <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-lg text-[11px] text-amber-800 dark:text-amber-300">
                        {tpl.unsupportedReason}
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 mt-4">
                    {tpl.isSupported ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadTemplate(tpl.importType)}
                          className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900"
                          title="Download pre-filled template"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>Template</span>
                        </Button>

                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept=".csv"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setSelectedType(tpl.importType);
                                handleFileSelected(file);
                              }
                            }}
                          />
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition">
                            <UploadCloud className="h-3.5 w-3.5" />
                            <span>Select File</span>
                          </span>
                        </label>
                      </>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">Not available in Phase 8</span>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* STAGE 2: COLUMN MAPPING INTERFACE */}
      {/* ============================================================ */}
      {step === 'COLUMN_MAPPING' && selectedTemplateDef && (
        <Card className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                {getTypeIcon(selectedTemplateDef.importType)}
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Map Spreadsheet Columns → {selectedTemplateDef.displayName}
                </h2>
                <p className="text-xs text-slate-500">
                  File: <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{selectedFile?.name}</span> ({rawCsvRows.length} data rows found)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleAutoMapColumns}
                className="flex items-center gap-1.5 text-xs text-blue-600 border-blue-200 dark:border-blue-800"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Auto-Map Columns</span>
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400">
                  <th className="p-3 font-semibold">MediDesk Target Field</th>
                  <th className="p-3 font-semibold">Requirement</th>
                  <th className="p-3 font-semibold">Status</th>
                  <th className="p-3 font-semibold">Your Spreadsheet Column</th>
                  <th className="p-3 font-semibold">Sample Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {selectedTemplateDef.columns.map((col) => {
                  const mappedCsvCol = columnMapping[col.name] || '';
                  const isMapped = Boolean(mappedCsvCol);
                  const sampleValue = isMapped && rawCsvRows.length > 0 ? rawCsvRows[0][mappedCsvCol] : '—';

                  return (
                    <tr key={col.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="p-3">
                        <div className="font-bold text-slate-900 dark:text-white font-mono text-[11px]">{col.name}</div>
                        <div className="text-[11px] text-slate-500">{col.description}</div>
                      </td>

                      <td className="p-3">
                        {col.required ? (
                          <Badge variant="danger" className="text-[10px]">Required</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">Optional</Badge>
                        )}
                      </td>

                      <td className="p-3">
                        {isMapped ? (
                          <div className="flex items-center gap-1 text-emerald-600 font-medium">
                            <Check className="h-3.5 w-3.5" />
                            <span>Mapped</span>
                          </div>
                        ) : col.required ? (
                          <div className="flex items-center gap-1 text-rose-600 font-medium">
                            <X className="h-3.5 w-3.5" />
                            <span>Missing</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-slate-400">
                            <span>Unmapped</span>
                          </div>
                        )}
                      </td>

                      <td className="p-3">
                        <select
                          value={mappedCsvCol}
                          onChange={(e) => {
                            const newMapping = { ...columnMapping, [col.name]: e.target.value };
                            if (!e.target.value) delete newMapping[col.name];
                            setColumnMapping(newMapping);
                          }}
                          className={`p-2 rounded-lg border text-xs w-full max-w-xs ${
                            isMapped
                              ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/20 text-slate-900 dark:text-white'
                              : col.required
                              ? 'border-rose-300 dark:border-rose-800 bg-rose-50/20 text-rose-900 dark:text-rose-200'
                              : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white'
                          }`}
                        >
                          <option value="">-- Select Spreadsheet Column --</option>
                          {csvHeaders.map((headerName) => (
                            <option key={headerName} value={headerName}>
                              {headerName}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="p-3 font-mono text-[11px] text-slate-500 max-w-[200px] truncate">
                        {sampleValue || <span className="text-slate-300 dark:text-slate-700 italic">empty</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" size="md" onClick={() => setStep('SELECT_TYPE')}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              <span>Back</span>
            </Button>

            <Button
              variant="primary"
              size="md"
              disabled={isValidating}
              onClick={handleProceedToValidation}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isValidating ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Validating Staging Data...</span>
                </>
              ) : (
                <>
                  <span>Validate & Preview Staged Data</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </Card>
      )}

      {/* ============================================================ */}
      {/* STAGE 3: VALIDATION PREVIEW & POLICY SELECTION */}
      {/* ============================================================ */}
      {step === 'VALIDATION_PREVIEW' && validationResult && selectedTemplateDef && (
        <div className="space-y-6">
          {/* Summary Breakdown Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold">Total Rows</span>
                <Layers className="h-4 w-4 text-slate-400" />
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {validationResult.totalRows}
              </p>
            </Card>

            <Card className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
              <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
                <span className="text-xs font-semibold">Ready to Import</span>
                <CheckCircle className="h-4 w-4" />
              </div>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                {validationResult.validCount}
              </p>
            </Card>

            <Card className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl">
              <div className="flex items-center justify-between text-amber-700 dark:text-amber-400">
                <span className="text-xs font-semibold">Warnings / Duplicates</span>
                <AlertTriangle className="h-4 w-4" />
              </div>
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">
                {validationResult.warningCount}
              </p>
            </Card>

            <Card className="p-4 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-xl">
              <div className="flex items-center justify-between text-rose-700 dark:text-rose-400">
                <span className="text-xs font-semibold">Invalid / Errors</span>
                <XCircle className="h-4 w-4" />
              </div>
              <p className="text-2xl font-bold text-rose-700 dark:text-rose-300 mt-1">
                {validationResult.errorCount}
              </p>
            </Card>
          </div>

          {/* Import Policy Selector Card */}
          <Card className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Select Import Execution Policy</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div
                onClick={() => setPolicy('REJECT_ALL_ON_ERROR')}
                className={`p-3.5 rounded-xl border flex flex-col justify-between cursor-pointer transition ${
                  policy === 'REJECT_ALL_ON_ERROR'
                    ? 'border-blue-600 bg-blue-50/40 text-blue-900 dark:bg-blue-950/30 dark:border-blue-500 dark:text-blue-200 font-semibold'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold">Reject Entire File on Error</span>
                    <Badge variant="outline" className="text-[10px]">Strict Safe</Badge>
                  </div>
                  <p className="text-slate-500 font-normal">
                    Aborts import completely if any single row contains an error. Mandatory for opening inventory stock.
                  </p>
                </div>
              </div>

              <div
                onClick={() => selectedType !== 'OPENING_STOCK' && setPolicy('IMPORT_VALID_ONLY')}
                className={`p-3.5 rounded-xl border flex flex-col justify-between transition ${
                  selectedType === 'OPENING_STOCK'
                    ? 'opacity-40 cursor-not-allowed border-slate-200'
                    : policy === 'IMPORT_VALID_ONLY'
                    ? 'border-blue-600 bg-blue-50/40 text-blue-900 dark:bg-blue-950/30 dark:border-blue-500 dark:text-blue-200 font-semibold cursor-pointer'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 cursor-pointer'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold">Import Valid Rows Only</span>
                    <Badge variant="outline" className="text-[10px]">Partial</Badge>
                  </div>
                  <p className="text-slate-500 font-normal">
                    Imports all valid rows ({validationResult.validCount}) and skips invalid rows without aborting.
                  </p>
                </div>
              </div>

              <div
                onClick={() => setPolicy('SKIP_DUPLICATES')}
                className={`p-3.5 rounded-xl border flex flex-col justify-between cursor-pointer transition ${
                  policy === 'SKIP_DUPLICATES'
                    ? 'border-blue-600 bg-blue-50/40 text-blue-900 dark:bg-blue-950/30 dark:border-blue-500 dark:text-blue-200 font-semibold'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold">Skip Duplicate Records</span>
                    <Badge variant="outline" className="text-[10px]">Dedup</Badge>
                  </div>
                  <p className="text-slate-500 font-normal">
                    Prevents re-importing existing patients or suppliers matching existing database records.
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Staged Data Preview Table */}
          <Card className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold">
                <button
                  onClick={() => setPreviewTab('ALL')}
                  className={`px-3 py-1.5 rounded-lg transition ${previewTab === 'ALL' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}
                >
                  All ({validationResult.totalRows})
                </button>
                <button
                  onClick={() => setPreviewTab('VALID')}
                  className={`px-3 py-1.5 rounded-lg transition ${previewTab === 'VALID' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500'}`}
                >
                  Valid ({validationResult.validCount})
                </button>
                {validationResult.warningCount > 0 && (
                  <button
                    onClick={() => setPreviewTab('WARNING')}
                    className={`px-3 py-1.5 rounded-lg transition ${previewTab === 'WARNING' ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm' : 'text-slate-500'}`}
                  >
                    Warnings ({validationResult.warningCount})
                  </button>
                )}
                {validationResult.errorCount > 0 && (
                  <button
                    onClick={() => setPreviewTab('ERROR')}
                    className={`px-3 py-1.5 rounded-lg transition ${previewTab === 'ERROR' ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm' : 'text-slate-500'}`}
                  >
                    Errors ({validationResult.errorCount})
                  </button>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={previewSearch}
                    onChange={(e) => setPreviewSearch(e.target.value)}
                    placeholder="Search rows..."
                    className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>

                {validationResult.errorCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportErrorsCsv}
                    className="flex items-center gap-1.5 text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download Error Report</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto max-h-96 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  <tr>
                    <th className="p-2.5 font-semibold">Row #</th>
                    <th className="p-2.5 font-semibold">Status</th>
                    {selectedTemplateDef.columns.slice(0, 4).map((c) => (
                      <th key={c.name} className="p-2.5 font-semibold">{c.name}</th>
                    ))}
                    <th className="p-2.5 font-semibold">Issues / Suggestions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredPreviewRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                        No rows found matching current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredPreviewRows.map((r) => (
                      <tr
                        key={r.rowNumber}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                          r.status === 'ERROR'
                            ? 'bg-rose-50/20 dark:bg-rose-950/10'
                            : r.status === 'WARNING'
                            ? 'bg-amber-50/20 dark:bg-amber-950/10'
                            : ''
                        }`}
                      >
                        <td className="p-2.5 font-mono text-slate-500">{r.rowNumber}</td>
                        <td className="p-2.5">
                          {r.status === 'VALID' && (
                            <Badge variant="success" className="text-[10px]">Valid</Badge>
                          )}
                          {r.status === 'WARNING' && (
                            <Badge variant="warning" className="text-[10px]">Warning</Badge>
                          )}
                          {r.status === 'ERROR' && (
                            <Badge variant="danger" className="text-[10px]">Error</Badge>
                          )}
                        </td>

                        {selectedTemplateDef.columns.slice(0, 4).map((c) => (
                          <td key={c.name} className="p-2.5 font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate max-w-[150px]">
                            {String(r.rawData[c.name] ?? '—')}
                          </td>
                        ))}

                        <td className="p-2.5 text-slate-500 text-[11px]">
                          {r.problems.length === 0 ? (
                            <span className="text-emerald-600 font-medium">Ready</span>
                          ) : (
                            <div className="space-y-1">
                              {r.problems.map((p, idx) => (
                                <div
                                  key={idx}
                                  className={p.severity === 'ERROR' ? 'text-rose-600 font-medium' : 'text-amber-600'}
                                >
                                  • [{p.field}]: {p.message}
                                  {p.suggestedFix && <span className="italic text-slate-400"> ({p.suggestedFix})</span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Step 3 Navigation */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button variant="outline" size="md" onClick={() => setStep('COLUMN_MAPPING')}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                <span>Adjust Column Mapping</span>
              </Button>

              <Button
                variant="primary"
                size="md"
                disabled={
                  (policy === 'REJECT_ALL_ON_ERROR' && validationResult.errorCount > 0) ||
                  validationResult.validCount === 0
                }
                onClick={() => setIsConfirmModalOpen(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <span>Proceed to Final Confirmation</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ============================================================ */}
      {/* FINAL CONFIRMATION MODAL */}
      {/* ============================================================ */}
      {isConfirmModalOpen && validationResult && selectedTemplateDef && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-lg p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Confirm Bulk Import</h3>
                <p className="text-xs text-slate-500">Review planned changes before committing to database</p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl space-y-2.5 text-xs">
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                You are about to import into <span className="font-bold text-blue-600">{selectedTemplateDef.displayName}</span>:
              </p>
              <ul className="space-y-1.5 font-medium text-slate-700 dark:text-slate-300">
                <li className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  <span>+{validationResult.validCount} new records will be created</span>
                </li>
                {policy === 'SKIP_DUPLICATES' && (
                  <li className="flex items-center gap-2 text-amber-600">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Duplicates matching existing clinic records will be safely skipped</span>
                  </li>
                )}
                {validationResult.errorCount > 0 && (
                  <li className="flex items-center gap-2 text-rose-600">
                    <XCircle className="h-4 w-4 shrink-0" />
                    <span>{validationResult.errorCount} invalid rows will be excluded</span>
                  </li>
                )}
                <li className="flex items-center gap-2 text-slate-500 pt-1 border-t border-slate-200 dark:border-slate-700 text-[11px]">
                  <HelpCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>No existing database records will be deleted.</span>
                </li>
              </ul>
            </div>

            {selectedType === 'OPENING_STOCK' && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs space-y-2">
                <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-bold">
                  <AlertTriangle className="h-4 w-4" />
                  <span>High-Risk Financial & Inventory Movement</span>
                </div>
                <p className="text-[11px] text-rose-600 dark:text-rose-400">
                  Opening stock creates permanent batch entries and adjustments in the stock ledger.
                </p>
                <label className="flex items-center gap-2 pt-1 font-semibold text-rose-800 dark:text-rose-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ownerConfirmed}
                    onChange={(e) => setOwnerConfirmed(e.target.checked)}
                    className="rounded text-rose-600 focus:ring-rose-500 h-4 w-4"
                  />
                  <span>I verify that opening stock prices and batches are accurate.</span>
                </label>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="outline"
                size="md"
                disabled={isExecuting}
                onClick={() => setIsConfirmModalOpen(false)}
              >
                <X className="h-4 w-4 mr-1" />
                <span>Cancel</span>
              </Button>

              <Button
                variant="primary"
                size="md"
                disabled={isExecuting || (selectedType === 'OPENING_STOCK' && !ownerConfirmed)}
                onClick={handleExecuteImport}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isExecuting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Executing Import ({executionProgress}%)...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    <span>Confirm & Execute Import</span>
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ============================================================ */}
      {/* STAGE 4: RESULT & AUDIT REPORT */}
      {/* ============================================================ */}
      {step === 'RESULT' && executionResult && (
        <Card className="p-8 max-w-2xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm space-y-6 text-center">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle className="h-8 w-8" />
          </div>

          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Bulk Import Successfully Completed
            </h2>
            <p className="text-xs text-slate-500">
              Transactions finalized and committed into SQLite storage with tamper-evident audit trail.
            </p>
          </div>

          {/* Metric Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-2xl border border-emerald-100 dark:border-emerald-800">
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">+ Added</span>
              <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-300 mt-0.5">{executionResult.createdCount}</p>
            </div>

            <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/30 rounded-2xl border border-blue-100 dark:border-blue-800">
              <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">↻ Updated</span>
              <p className="text-2xl font-bold text-blue-800 dark:text-blue-300 mt-0.5">{executionResult.updatedCount}</p>
            </div>

            <div className="p-3.5 bg-amber-50/60 dark:bg-amber-950/30 rounded-2xl border border-amber-100 dark:border-amber-800">
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">⏭ Skipped</span>
              <p className="text-2xl font-bold text-amber-800 dark:text-amber-300 mt-0.5">{executionResult.skippedCount}</p>
            </div>

            <div className="p-3.5 bg-slate-100/60 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Duration</span>
              <p className="text-xl font-bold text-slate-800 dark:text-slate-200 mt-0.5">{executionResult.executionTimeMs}ms</p>
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-[11px] font-mono text-slate-500 flex items-center justify-center gap-2">
            <span>Audit Event Logged:</span>
            <span className="text-blue-600 font-bold">{executionResult.auditEventId || 'DATA_IMPORTED'}</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            {executionResult.rejectedCount > 0 && (
              <Button variant="outline" size="md" onClick={handleExportErrorsCsv} className="flex items-center gap-1.5 text-xs text-rose-600 border-rose-200">
                <Download className="h-4 w-4" />
                <span>Download Error Report</span>
              </Button>
            )}

            {onNavigate && (
              <Button variant="outline" size="md" onClick={() => onNavigate('audit')} className="flex items-center gap-1.5 text-xs">
                <span>View in Audit Trail</span>
              </Button>
            )}

            <Button variant="primary" size="md" onClick={handleReset} className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white">
              <Check className="h-4 w-4" />
              <span>Import Another File</span>
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};
