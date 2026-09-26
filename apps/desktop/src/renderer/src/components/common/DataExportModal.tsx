import React, { useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  FileText,
  CheckCircle,
  Eye,
  X,
  Filter,
  Layers
} from 'lucide-react';
import { Button, Card, Badge } from '@medidesk/ui';
import { SessionUser } from '@medidesk/domain';

export interface ExportColumn<T = any> {
  key: string;
  header: string;
  format?: (value: any, row: T) => string;
}

export interface DataExportModalProps<T = any> {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  entityName: string;
  data: T[];
  columns: ExportColumn<T>[];
  currentUser: SessionUser;
  defaultFilename?: string;
  activeFilterPredicate?: (row: T) => boolean;
}

export const DataExportModal: React.FC<DataExportModalProps> = ({
  isOpen,
  onClose,
  title,
  entityName,
  data,
  columns,
  currentUser: _currentUser,
  defaultFilename,
  activeFilterPredicate
}) => {
  const [format, setFormat] = useState<'CSV' | 'JSON'>('CSV');
  const [scope, setScope] = useState<'ALL' | 'ACTIVE_ONLY'>('ALL');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(columns.map((c) => c.key));

  if (!isOpen) return null;

  // Filter records based on scope
  const filteredData = data.filter((row: any) => {
    if (scope === 'ACTIVE_ONLY') {
      if (activeFilterPredicate) {
        return activeFilterPredicate(row);
      }
      return row.isActive !== false && row.status !== 'INACTIVE';
    }
    return true;
  });

  const activeColumns = columns.filter((col) => selectedColumns.includes(col.key));

  const toggleColumn = (key: string) => {
    if (selectedColumns.includes(key)) {
      if (selectedColumns.length > 1) {
        setSelectedColumns(selectedColumns.filter((k) => k !== key));
      }
    } else {
      setSelectedColumns([...selectedColumns, key]);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const filename = defaultFilename || `${entityName.toLowerCase()}_export_${new Date().toISOString().split('T')[0]}`;

      if (format === 'CSV') {
        const headers = activeColumns.map((c) => `"${c.header.replace(/"/g, '""')}"`).join(',');
        const rows = filteredData.map((row) =>
          activeColumns
            .map((c) => {
              const val = c.format ? c.format(row[c.key], row) : row[c.key];
              const strVal = val === undefined || val === null ? '' : String(val);
              return `"${strVal.replace(/"/g, '""')}"`;
            })
            .join(',')
        );
        const csvContent = [headers, ...rows].join('\r\n');
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${filename}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const jsonData = filteredData.map((row) => {
          const formattedRow: Record<string, any> = {};
          for (const c of activeColumns) {
            formattedRow[c.header] = c.format ? c.format(row[c.key], row) : row[c.key];
          }
          return formattedRow;
        });
        const jsonString = JSON.stringify(jsonData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${filename}.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      setExportComplete(true);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleReset = () => {
    setExportComplete(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <Card className="w-full max-w-xl p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl max-h-[90vh] overflow-y-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <Download className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">{title}</h2>
              <p className="text-xs text-slate-500">Export master records safely to spreadsheet or JSON format</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
            title="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {exportComplete ? (
          <div className="py-6 text-center space-y-4">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto">
              <CheckCircle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Export Generated Successfully</h3>
              <p className="text-xs text-slate-500 mt-1">
                Downloaded {filteredData.length} {entityName.toLowerCase()} records in {format} format.
              </p>
            </div>
            <div className="pt-2 flex justify-center">
              <Button variant="primary" size="md" onClick={handleReset} className="flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4" />
                <span>Done</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            {/* 1. Format Selection */}
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                Choose Export Format
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div
                  onClick={() => setFormat('CSV')}
                  className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition ${
                    format === 'CSV'
                      ? 'border-blue-600 bg-blue-50/50 text-blue-900 dark:bg-blue-950/40 dark:border-blue-500 dark:text-blue-200 font-semibold'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <FileSpreadsheet className="h-5 w-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="font-medium">Excel / CSV</p>
                    <p className="text-[11px] text-slate-400 font-normal">Compatible with Microsoft Excel & Sheets</p>
                  </div>
                </div>

                <div
                  onClick={() => setFormat('JSON')}
                  className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition ${
                    format === 'JSON'
                      ? 'border-blue-600 bg-blue-50/50 text-blue-900 dark:bg-blue-950/40 dark:border-blue-500 dark:text-blue-200 font-semibold'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <FileText className="h-5 w-5 text-indigo-600 shrink-0" />
                  <div>
                    <p className="font-medium">JSON Format</p>
                    <p className="text-[11px] text-slate-400 font-normal">Raw structured data for software integration</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Scope Selection */}
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                Select Record Scope
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div
                  onClick={() => setScope('ALL')}
                  className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                    scope === 'ALL'
                      ? 'border-blue-600 bg-blue-50/40 text-blue-900 dark:bg-blue-950/30 dark:border-blue-500 dark:text-blue-200 font-medium'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-slate-500" />
                    <span>All Records</span>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{data.length}</Badge>
                </div>

                <div
                  onClick={() => setScope('ACTIVE_ONLY')}
                  className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                    scope === 'ACTIVE_ONLY'
                      ? 'border-blue-600 bg-blue-50/40 text-blue-900 dark:bg-blue-950/30 dark:border-blue-500 dark:text-blue-200 font-medium'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-emerald-500" />
                    <span>Active Only</span>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{filteredData.length}</Badge>
                </div>
              </div>
            </div>

            {/* 3. Column Selection */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Select Columns to Include ({selectedColumns.length}/{columns.length})
                </label>
                <div className="flex items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setSelectedColumns(columns.map((c) => c.key))}
                    className="text-blue-600 hover:underline"
                  >
                    Select All
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => setSelectedColumns([columns[0].key])}
                    className="text-slate-400 hover:underline"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl max-h-32 overflow-y-auto">
                {columns.map((col) => (
                  <label
                    key={col.key}
                    className="flex items-center gap-1.5 text-[11px] cursor-pointer hover:text-slate-900 dark:hover:text-white"
                  >
                    <input
                      type="checkbox"
                      checked={selectedColumns.includes(col.key)}
                      onChange={() => toggleColumn(col.key)}
                      className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                    />
                    <span className="truncate">{col.header}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 4. Preview Toggle */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setIsPreviewOpen(!isPreviewOpen)}
                className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1 font-medium"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>{isPreviewOpen ? 'Hide Sample Preview' : 'Show Sample Preview'}</span>
              </button>

              {isPreviewOpen && (
                <div className="mt-2 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden overflow-x-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      <tr>
                        {activeColumns.map((col) => (
                          <th key={col.key} className="p-2 truncate font-semibold">{col.header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredData.slice(0, 3).map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          {activeColumns.map((col) => (
                            <td key={col.key} className="p-2 truncate text-slate-700 dark:text-slate-300">
                              {col.format ? col.format(row[col.key], row) : String(row[col.key] ?? '—')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
              <Button variant="outline" size="md" onClick={onClose} disabled={isExporting}>
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>

              <Button
                variant="primary"
                size="md"
                onClick={handleExport}
                disabled={isExporting || filteredData.length === 0 || selectedColumns.length === 0}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Download className="h-4 w-4" />
                <span>{isExporting ? 'Generating Export...' : `Export ${filteredData.length} Records`}</span>
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
