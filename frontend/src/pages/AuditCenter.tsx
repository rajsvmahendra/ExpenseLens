import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  ShieldCheck, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  X,
  FileCheck,
  UserCheck,
  Coins,
  FileSpreadsheet
} from 'lucide-react';
import { api } from '../services/api';

export default function AuditCenter() {
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Resolution Modal State
  const [activeAnomaly, setActiveAnomaly] = useState<any>(null);
  const [resolutionAction, setResolutionAction] = useState<string>('');
  const [reasoning, setReasoning] = useState<string>('');
  const [resolving, setResolving] = useState(false);
  const [modalError, setModalError] = useState<string>('');

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
    loadAnomalies();
  }, [selectedGroupId]);

  const loadAnomalies = async () => {
    setLoading(true);
    try {
      const data = await api.anomalies.list(selectedGroupId);
      setAnomalies(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenResolve = (anomaly: any) => {
    setActiveAnomaly(anomaly);
    setReasoning('');
    setModalError('');
    
    // Auto-select logical resolution action based on anomaly type
    if (anomaly.anomaly_type === 'DUPLICATE_EXPENSE') {
      setResolutionAction('MERGE');
    } else if (anomaly.anomaly_type === 'SETTLEMENT_AS_EXPENSE') {
      setResolutionAction('CONVERT_TO_SETTLEMENT');
    } else {
      setResolutionAction('DISMISS');
    }
  };

  const handleCloseResolve = () => {
    setActiveAnomaly(null);
  };

  const handleSubmitResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reasoning.trim()) {
      setModalError('Please enter a reasoning explanation for this decision trail.');
      return;
    }

    setResolving(true);
    setModalError('');
    try {
      await api.anomalies.resolve(activeAnomaly.id, {
        resolution_action: resolutionAction,
        reasoning: reasoning
      });
      // Refresh anomalies queue
      await loadAnomalies();
      handleCloseResolve();
    } catch (err: any) {
      setModalError(err.message || 'Failed to submit resolution.');
    } finally {
      setResolving(false);
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'HIGH':
        return 'bg-red-50 text-brand-danger border-red-100';
      case 'MEDIUM':
        return 'bg-amber-50 text-brand-warning border-amber-100';
      default:
        return 'bg-blue-50 text-blue-500 border-blue-100';
    }
  };

  const activeQueue = anomalies.filter(a => !a.is_resolved);
  const resolvedHistory = anomalies.filter(a => a.is_resolved);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-950 tracking-tight">Audit Center & Verification Queue</h2>
          <p className="text-sm text-gray-400 mt-1 font-medium">Resolves roommate conflicts, duplicate logs, currency exchange values, and settlement errors.</p>
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

      {/* Loading Overlay */}
      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white border border-gray-50 rounded-2xl h-24"></div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left: Active Verification Queue (2/3 col) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between border-b border-gray-50 pb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-brand-warning" />
                <h3 className="font-bold text-gray-900 text-base">Active Issues Queue</h3>
              </div>
              <span className="bg-amber-50 text-brand-warning text-xs font-bold px-2.5 py-1 rounded-full border border-amber-100">
                {activeQueue.length} Issues Pending
              </span>
            </div>

            {activeQueue.length === 0 ? (
              <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm flex flex-col items-center justify-center">
                <div className="bg-green-50 text-brand-success p-4 rounded-full mb-4">
                  <ShieldCheck size={32} />
                </div>
                <h3 className="font-bold text-gray-900 text-base">Audit Certified Clean!</h3>
                <p className="text-xs text-gray-400 mt-1 max-w-sm">
                  No data anomalies detected. All splits, currencies, and roommate membership date windows are valid.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeQueue.map((anomaly) => (
                  <div key={anomaly.id} className="bg-white border border-gray-100 hover:border-gray-200 rounded-2xl p-6 shadow-sm transition-all duration-150 flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="space-y-3 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${getSeverityBadge(anomaly.severity)}`}>
                          {anomaly.severity} SEVERITY
                        </span>
                        <span className="bg-gray-100 text-gray-500 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                          {anomaly.anomaly_type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      
                      <h4 className="font-bold text-gray-950 text-sm">{anomaly.expense_description || 'System Data Conflict'}</h4>
                      <p className="text-xs text-gray-400 font-medium leading-relaxed">{anomaly.description}</p>
                      
                      {/* Diagnostic details */}
                      <div className="bg-gray-50/50 rounded-xl p-3.5 border border-gray-50 text-[11px] grid grid-cols-2 sm:grid-cols-3 gap-4 text-gray-500 font-medium">
                        {anomaly.detected_at && (
                          <div>
                            <span className="block text-[9px] text-gray-400 font-bold uppercase">Detected</span>
                            <span>{new Date(anomaly.detected_at).toLocaleDateString()}</span>
                          </div>
                        )}
                        {anomaly.expense && (
                          <div>
                            <span className="block text-[9px] text-gray-400 font-bold uppercase">Source Record</span>
                            <span className="truncate block max-w-xs">Expense Ref: #{anomaly.expense.substring(0,8)}</span>
                          </div>
                        )}
                        {anomaly.extra_data?.member_name && (
                          <div>
                            <span className="block text-[9px] text-gray-400 font-bold uppercase">Conflicting Member</span>
                            <span>{anomaly.extra_data.member_name}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center md:self-center">
                      <button
                        onClick={() => handleOpenResolve(anomaly)}
                        className="bg-brand-primary hover:bg-indigo-600 text-white rounded-xl px-5 py-2.5 text-xs font-bold shadow-sm transition-all duration-150"
                      >
                        Action Item
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Resolved Audit History Logs (1/3 col) */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 border-b border-gray-50 pb-4">
              <CheckCircle2 size={16} className="text-gray-400" />
              <h3 className="font-bold text-gray-900 text-sm">Resolution History</h3>
            </div>

            {resolvedHistory.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-10">No resolved issues logged yet.</p>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                {resolvedHistory.map((item) => (
                  <div key={item.id} className="bg-white border border-gray-100 rounded-xl p-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-brand-success bg-green-50 px-2 py-0.5 rounded-full font-bold">
                        RESOLVED
                      </span>
                      <span className="text-gray-400 text-[10px]">{new Date(item.detected_at).toLocaleDateString()}</span>
                    </div>
                    <p className="font-bold text-gray-800">{item.expense_description || 'Data Conflict'}</p>
                    <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-50 text-gray-500 font-medium leading-relaxed">
                      <span className="font-bold text-gray-600 block text-[9px] uppercase mb-0.5">Resolution: {item.resolution_action}</span>
                      {item.description}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Resolution Tray Modal */}
      {activeAnomaly && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 relative animate-slide-in space-y-6 border border-gray-100">
            {/* Modal Close */}
            <button 
              onClick={handleCloseResolve}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-900 p-1.5 hover:bg-gray-150 rounded-lg"
            >
              <X size={20} />
            </button>

            {/* Modal Header */}
            <div>
              <span className="bg-indigo-50 text-brand-primary text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider border border-indigo-100">
                Resolution Dashboard
              </span>
              <h3 className="text-base font-extrabold text-gray-950 mt-2.5">
                Resolve {activeAnomaly.expense_description || 'Anomaly Conflict'}
              </h3>
              <p className="text-xs text-gray-400 mt-1 leading-normal">{activeAnomaly.description}</p>
            </div>

            {/* Resolution Form */}
            <form onSubmit={handleSubmitResolve} className="space-y-5">
              
              {/* Error box */}
              {modalError && (
                <div className="bg-red-50 border border-red-100 text-brand-danger text-xs font-semibold rounded-xl p-3">
                  {modalError}
                </div>
              )}

              {/* Resolution Action Picker */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Select Resolution Action</label>
                <div className="grid grid-cols-2 gap-3">
                  
                  {activeAnomaly.anomaly_type === 'DUPLICATE_EXPENSE' && (
                    <button
                      type="button"
                      onClick={() => setResolutionAction('MERGE')}
                      className={`p-3.5 border rounded-xl flex flex-col gap-1.5 text-left transition-all ${
                        resolutionAction === 'MERGE'
                          ? 'border-brand-primary bg-indigo-50/20 text-brand-primary font-bold'
                          : 'border-gray-100 hover:bg-gray-50 text-gray-500'
                      }`}
                    >
                      <Trash2 size={16} />
                      <span className="text-xs">Merge Duplicate</span>
                      <span className="text-[9px] text-gray-400 font-medium">Deletes secondary duplicate expense logs.</span>
                    </button>
                  )}

                  {activeAnomaly.anomaly_type === 'SETTLEMENT_AS_EXPENSE' && (
                    <button
                      type="button"
                      onClick={() => setResolutionAction('CONVERT_TO_SETTLEMENT')}
                      className={`p-3.5 border rounded-xl flex flex-col gap-1.5 text-left transition-all ${
                        resolutionAction === 'CONVERT_TO_SETTLEMENT'
                          ? 'border-brand-primary bg-indigo-50/20 text-brand-primary font-bold'
                          : 'border-gray-100 hover:bg-gray-50 text-gray-500'
                      }`}
                    >
                      <Coins size={16} />
                      <span className="text-xs">Convert to Settlement</span>
                      <span className="text-[9px] text-gray-400 font-medium">Hides this expense and records a Settlement.</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setResolutionAction('DISMISS')}
                    className={`p-3.5 border rounded-xl flex flex-col gap-1.5 text-left transition-all ${
                      resolutionAction === 'DISMISS'
                        ? 'border-brand-primary bg-indigo-50/20 text-brand-primary font-bold'
                        : 'border-gray-100 hover:bg-gray-50 text-gray-500'
                    }`}
                  >
                    <FileCheck size={16} />
                    <span className="text-xs">Dismiss / Ignore</span>
                    <span className="text-[9px] text-gray-400 font-medium">Dismisses the warning and keeps original splits.</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setResolutionAction('CORRECT_MEMBERSHIP')}
                    className={`p-3.5 border rounded-xl flex flex-col gap-1.5 text-left transition-all ${
                      resolutionAction === 'CORRECT_MEMBERSHIP'
                        ? 'border-brand-primary bg-indigo-50/20 text-brand-primary font-bold'
                        : 'border-gray-100 hover:bg-gray-50 text-gray-500'
                    }`}
                  >
                    <UserCheck size={16} />
                    <span className="text-xs">Correct Splits</span>
                    <span className="text-[9px] text-gray-400 font-medium">Flags that timeline split will be adjusted.</span>
                  </button>
                </div>
              </div>

              {/* Reasoning Input */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Justification / Reasoning (Logs to Decision Trail)
                </label>
                <textarea
                  rows={3}
                  required
                  value={reasoning}
                  onChange={(e) => setReasoning(e.target.value)}
                  placeholder="Explain why this resolution is correct (e.g. 'Rohan confirmed this transfer was repayment for taxi fare...')"
                  className="w-full bg-gray-50/50 border border-gray-150 focus:border-brand-primary focus:bg-white rounded-xl p-3 text-xs outline-none transition-all resize-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-50">
                <button
                  type="button"
                  onClick={handleCloseResolve}
                  className="px-4 py-2.5 rounded-xl border border-gray-100 hover:bg-gray-50 text-xs font-semibold text-gray-500 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resolving}
                  className="bg-brand-primary hover:bg-indigo-600 text-white rounded-xl px-5 py-2.5 text-xs font-bold shadow-md shadow-indigo-100 transition-all disabled:opacity-50"
                >
                  {resolving ? 'Logging...' : 'Submit Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
