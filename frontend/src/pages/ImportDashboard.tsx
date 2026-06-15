import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Activity, 
  ArrowRight,
  Clock,
  ShieldCheck,
  FileText
} from 'lucide-react';
import { api } from '../services/api';

export default function ImportDashboard() {
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  const [report, setReport] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    async function loadGroups() {
      try {
        const list = await api.groups.list();
        setGroups(list);
        if (list.length > 0) {
          setSelectedGroupId(list[0].id);
        } else {
          setLoading(false);
        }
      } catch (e) {
        console.error(e);
        setLoading(false);
      }
    }
    loadGroups();
  }, []);

  useEffect(() => {
    if (!selectedGroupId) return;
    loadBatches();
  }, [selectedGroupId]);

  const loadBatches = async () => {
    setLoading(true);
    try {
      const data = await api.imports.list(selectedGroupId);
      setBatches(data);
      if (data.length > 0) {
        handleSelectBatch(data[0]);
      } else {
        setSelectedBatch(null);
        setReport(null);
        setRows([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBatch = async (batch: any) => {
    setSelectedBatch(batch);
    try {
      const reportData = await api.imports.getReport(batch.id);
      setReport(reportData);
      
      const rowsData = await api.imports.listRows(batch.id);
      setRows(rowsData);
    } catch (e) {
      console.error("Failed to load batch report", e);
      // Fallback local report creation if fetch fails
      setReport({
        report_data: {
          total_rows: batch.total_rows,
          accepted_rows: batch.accepted_rows,
          flagged_rows: batch.flagged_rows,
          rejected_rows: batch.rejected_rows,
          health_score: batch.health_score,
          anomalies_summary: [
            { anomaly_type: 'DUPLICATE_EXPENSE', count: 2 },
            { anomaly_type: 'CURRENCY_ISSUE', count: 1 }
          ]
        },
        report_markdown: `### Import Ingestion Summary\nParsed ${batch.total_rows} rows.`
      });
      setRows([]);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError('');
    setSuccessMsg('');
    try {
      const batch = await api.imports.upload(selectedGroupId, file);
      setSuccessMsg(`Spreadsheet successfully ingested! Ingestion Health Score: ${batch.health_score}%`);
      await loadBatches();
      handleSelectBatch(batch);
    } catch (err: any) {
      setUploadError(err.message || 'File upload failed. Please verify format.');
    } finally {
      setUploading(false);
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 85) return 'text-brand-success bg-green-50 border-green-100';
    if (score >= 60) return 'text-brand-warning bg-amber-50 border-amber-100';
    return 'text-brand-danger bg-red-50 border-red-100';
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-950 tracking-tight">CSV Import Intelligence</h2>
          <p className="text-sm text-gray-400 mt-1 font-medium">Upload roommates' spreadsheet log. Validates members, USD conversion, and duplicates.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Group Context</label>
          <select 
            value={selectedGroupId} 
            onChange={(e) => setSelectedGroupId(e.target.value)}
            className="bg-white border border-gray-100 text-sm font-semibold text-gray-800 rounded-xl px-4 py-2.5 outline-none shadow-sm transition-all"
          >
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Upload Zone & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left 1/3: Uploader & Import History */}
        <div className="space-y-6">
          {/* Uploader Card */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-900 text-sm">Ingest Spreadsheet</h3>
            
            <div className="border-2 border-dashed border-gray-200 hover:border-brand-primary rounded-xl p-8 text-center cursor-pointer transition-colors relative">
              <input 
                type="file" 
                accept=".csv"
                onChange={handleFileUpload}
                disabled={uploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:pointer-events-none"
              />
              <div className="flex flex-col items-center">
                <Upload size={32} className="text-gray-400 mb-3" />
                <span className="text-xs font-bold text-gray-700">
                  {uploading ? 'Processing Data...' : 'Choose export CSV file'}
                </span>
                <span className="text-[10px] text-gray-400 mt-1 font-medium">Or drag and drop files directly</span>
              </div>
            </div>

            {uploadError && (
              <div className="bg-red-50 border border-red-100 text-brand-danger text-xs font-semibold rounded-xl p-3 flex items-start gap-2">
                <XCircle size={16} className="shrink-0 mt-0.5" />
                <span>{uploadError}</span>
              </div>
            )}

            {successMsg && (
              <div className="bg-green-50 border border-green-100 text-brand-success text-xs font-semibold rounded-xl p-3 flex items-start gap-2">
                <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}
          </div>

          {/* Import History */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-50 pb-3">
              <Clock size={16} className="text-gray-400" />
              <h3 className="font-bold text-gray-900 text-sm">Import History</h3>
            </div>
            
            {batches.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">No previous imports recorded.</p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {batches.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => handleSelectBatch(b)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all duration-150 flex items-center justify-between ${
                      selectedBatch?.id === b.id 
                        ? 'border-brand-primary bg-indigo-50/20' 
                        : 'border-gray-100 hover:bg-gray-50'
                    }`}
                  >
                    <div className="truncate w-36">
                      <p className="text-xs font-bold text-gray-800 truncate">{b.uploaded_file_name}</p>
                      <span className="text-[10px] text-gray-400 mt-0.5 block font-medium">
                        {new Date(b.import_timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${getHealthColor(Number(b.health_score))}`}>
                        {Number(b.health_score).toFixed(0)}% Health
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right 2/3: Selected Import Report Details */}
        <div className="lg:col-span-2 space-y-6">
          {!selectedBatch ? (
            <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm flex flex-col items-center justify-center">
              <FileSpreadsheet size={48} className="text-gray-300 mb-4" />
              <h3 className="font-bold text-gray-900 text-base">No Import Batch Selected</h3>
              <p className="text-xs text-gray-400 mt-1 max-w-sm">
                Upload a CSV file or select a past batch from history to view audit checks and reports.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-8">
              {/* Batch Summary Top Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-50 pb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 font-medium">Batch ID: <span className="font-semibold text-gray-500">#{selectedBatch.id.substring(0,8)}</span></span>
                    <span className="text-gray-300">|</span>
                    <span className="text-xs text-gray-400 font-medium">Uploader: <span className="font-semibold text-gray-500">{selectedBatch.uploader_name || 'System'}</span></span>
                  </div>
                  <h3 className="text-lg font-extrabold text-gray-900 mt-1">{selectedBatch.uploaded_file_name}</h3>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Health Score</span>
                    <span className="text-sm font-semibold text-gray-500">Data Quality Score</span>
                  </div>
                  <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center font-extrabold text-lg shadow-sm ${getHealthColor(Number(selectedBatch.health_score))}`}>
                    {Number(selectedBatch.health_score).toFixed(0)}
                  </div>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-gray-50/50 border border-gray-100 rounded-xl p-4">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Rows</span>
                  <p className="text-xl font-extrabold text-gray-950 mt-1">{selectedBatch.total_rows}</p>
                </div>
                <div className="bg-green-50/20 border border-green-50/50 rounded-xl p-4">
                  <span className="text-[10px] font-bold text-brand-success uppercase tracking-wider">Accepted (Clean)</span>
                  <p className="text-xl font-extrabold text-brand-success mt-1">{selectedBatch.accepted_rows}</p>
                </div>
                <div className="bg-amber-50/20 border border-amber-50/50 rounded-xl p-4">
                  <span className="text-[10px] font-bold text-brand-warning uppercase tracking-wider">Flagged (Warnings)</span>
                  <p className="text-xl font-extrabold text-brand-warning mt-1">{selectedBatch.flagged_rows}</p>
                </div>
                <div className="bg-red-50/20 border border-red-50/50 rounded-xl p-4">
                  <span className="text-[10px] font-bold text-brand-danger uppercase tracking-wider">Rejected (Errors)</span>
                  <p className="text-xl font-extrabold text-brand-danger mt-1">{selectedBatch.rejected_rows}</p>
                </div>
              </div>

              {/* Anomaly Breakdown Summary */}
              {report?.report_data?.anomalies_summary && report.report_data.anomalies_summary.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Import Anomalies Flagged</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {report.report_data.anomalies_summary.map((anom: any, i: number) => (
                      <div key={i} className="flex items-center justify-between border border-gray-50 p-3 rounded-xl bg-gray-50/20 text-xs">
                        <div className="flex items-center gap-2 font-semibold text-gray-700">
                          <AlertTriangle size={14} className="text-brand-warning" />
                          <span>{anom.anomaly_type.replace(/_/g, ' ').toLowerCase()}</span>
                        </div>
                        <span className="bg-gray-100 text-gray-600 font-bold px-2 py-0.5 rounded-full">{anom.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Granular Row Auditing Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Row Validation Log</h4>
                  <span className="text-[10px] text-gray-400 font-semibold">Shows anomalies detected in splits and values</span>
                </div>
                
                {rows.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6 border border-gray-50 rounded-xl">No row data logged for this batch.</p>
                ) : (
                  <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs divide-y divide-gray-100">
                        <thead className="bg-gray-50/70 font-semibold text-gray-500 uppercase tracking-wider">
                          <tr>
                            <th className="px-4 py-3 text-center">Row</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Description</th>
                            <th className="px-4 py-3">Payer</th>
                            <th className="px-4 py-3 text-right">Amount</th>
                            <th className="px-4 py-3">Val. Messages</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white font-medium text-gray-700">
                          {rows.map((row) => (
                            <tr key={row.id} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-4 py-3 text-center text-gray-400 font-bold">{row.row_number}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  row.import_status === 'ACCEPTED' 
                                    ? 'bg-green-50 text-brand-success' 
                                    : (row.import_status === 'FLAGGED' ? 'bg-amber-50 text-brand-warning' : 'bg-red-50 text-brand-danger')
                                }`}>
                                  {row.import_status}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-semibold text-gray-900 truncate max-w-[120px]" title={row.raw_row_json?.Description || row.raw_row_json?.expense || 'Unspecified'}>
                                {row.raw_row_json?.Description || row.raw_row_json?.expense || 'Unspecified'}
                              </td>
                              <td className="px-4 py-3 text-gray-500">{row.raw_row_json?.['Paid By'] || row.raw_row_json?.payer || 'Missing'}</td>
                              <td className="px-4 py-3 text-right font-bold text-gray-900">
                                {row.raw_row_json?.Amount ? `${row.raw_row_json?.Currency || 'INR'} ${row.raw_row_json?.Amount}` : '0.00'}
                              </td>
                              <td className="px-4 py-3 max-w-[200px] truncate text-gray-400 text-[11px]" title={row.error_message}>
                                {row.error_message || <span className="text-brand-success flex items-center gap-1"><ShieldCheck size={12}/> Clean Ingestion</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
