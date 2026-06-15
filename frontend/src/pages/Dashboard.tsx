import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  DollarSign, 
  AlertTriangle, 
  FileCheck, 
  Users, 
  ArrowRightLeft, 
  ArrowRight,
  TrendingUp,
  AlertCircle,
  FileSpreadsheet,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';
import { api } from '../services/api';

export default function Dashboard() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [balances, setBalances] = useState<any>({ member_balances: [], simplified_debts: [] });
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [imports, setImports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Load initial group list
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
        console.error("Failed to load groups", e);
        setLoading(false);
      }
    }
    loadGroups();
  }, []);

  // Load selected group stats
  useEffect(() => {
    if (!selectedGroupId) return;

    async function loadGroupData() {
      setLoading(true);
      try {
        const [balData, anomData, impData] = await Promise.all([
          api.groups.getBalances(selectedGroupId),
          api.anomalies.list(selectedGroupId),
          api.imports.list(selectedGroupId)
        ]);

        setBalances(balData);
        setAnomalies(anomData);
        setImports(impData);
      } catch (e) {
        console.error("Failed to load group details", e);
      } finally {
        setLoading(false);
      }
    }

    loadGroupData();
  }, [selectedGroupId]);

  if (groups.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <div className="bg-indigo-50 text-brand-primary p-4 rounded-full mb-4">
          <Users size={36} />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">No Groups Found</h3>
        <p className="text-sm text-gray-400 max-w-sm mb-6">
          To get started, you must first create a sharing group or import a spreadsheet log.
        </p>
        <button
          onClick={async () => {
            setLoading(true);
            try {
              const newGroup = await api.groups.create({
                name: 'Flatmates Shared Expenses',
                description: 'Flat share expense logs for Aisha, Rohan, Priya, Meera, Dev, Sam.',
                base_currency: 'INR'
              });
              setGroups([newGroup]);
              setSelectedGroupId(newGroup.id);
            } catch (e) {
              console.error("Failed to auto-create group", e);
              setLoading(false);
            }
          }}
          className="bg-brand-primary hover:bg-indigo-600 text-white rounded-xl px-6 py-3 text-sm font-semibold shadow-md shadow-indigo-100 transition-all duration-150"
        >
          Create Flatmate Group
        </button>
      </div>
    );
  }

  // Calculate metrics
  const activeGroup = groups.find(g => g.id === selectedGroupId) || {};
  const totalGroupExpenses = balances.member_balances.reduce((sum: number, m: any) => sum + m.total_paid_expenses, 0);
  
  // Pending unresolved anomalies
  const pendingAnomaliesCount = anomalies.filter((a: any) => !a.is_resolved).length;
  
  // Latest import health score
  const latestImport = imports[0];
  const healthScore = latestImport ? Number(latestImport.health_score) : 100;

  // Active members count
  const activeMembersCount = balances.member_balances.length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Welcome Heading / Group Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-950 tracking-tight">Financial Intelligence Dashboard</h2>
          <p className="text-sm text-gray-400 mt-1 font-medium">Real-time audit status, simplified debts, and anomalies tracker.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active Group</label>
          <select 
            value={selectedGroupId} 
            onChange={(e) => setSelectedGroupId(e.target.value)}
            className="bg-white border border-gray-100 hover:border-gray-200 text-sm font-semibold text-gray-800 rounded-xl px-4 py-2.5 outline-none shadow-sm transition-all cursor-pointer"
          >
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading Overlay */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white border border-gray-50 rounded-2xl h-32"></div>
          ))}
        </div>
      ) : (
        <>
          {/* Dashboard Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Total Spending */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all duration-150 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Group Total Spending</span>
                <div className="bg-indigo-50 text-brand-primary p-2 rounded-xl">
                  <TrendingUp size={16} />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-extrabold text-gray-950">₹{totalGroupExpenses.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</h3>
                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                  Base currency: <span className="font-semibold text-gray-500">{activeGroup.base_currency}</span>
                </p>
              </div>
            </div>

            {/* Pending Anomalies */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all duration-150">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pending Anomalies</span>
                <div className={`p-2 rounded-xl ${pendingAnomaliesCount > 0 ? 'bg-red-50 text-brand-danger animate-pulse' : 'bg-green-50 text-brand-success'}`}>
                  <AlertTriangle size={16} />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-extrabold text-gray-950">{pendingAnomaliesCount}</h3>
                <p className="text-xs text-gray-400 mt-1">
                  {pendingAnomaliesCount > 0 ? 'Needs review in Audit Center' : 'All spreadsheet entries clean'}
                </p>
              </div>
            </div>

            {/* Health Score */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all duration-150">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Import Data Health</span>
                <div className={`p-2 rounded-xl ${healthScore >= 80 ? 'bg-green-50 text-brand-success' : 'bg-amber-50 text-brand-warning'}`}>
                  <FileCheck size={16} />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-extrabold text-gray-950">{healthScore.toFixed(1)}%</h3>
                {/* Visual score bar */}
                <div className="w-full bg-gray-100 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${healthScore >= 80 ? 'bg-brand-success' : 'bg-brand-warning'}`} 
                    style={{ width: `${healthScore}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Active Members */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all duration-150">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active Members</span>
                <div className="bg-teal-50 text-brand-accent p-2 rounded-xl">
                  <Users size={16} />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-extrabold text-gray-950">{activeMembersCount}</h3>
                <p className="text-xs text-gray-400 mt-1">Timeline-aware participants</p>
              </div>
            </div>
          </div>

          {/* Main Content Grid: Settlement Suggestions & Quick Tools */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left: Settlement Suggestions (Explain My Balance Shortcut) */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between border-b border-gray-50 pb-4">
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Debt Settlement Plan</h3>
                  <p className="text-xs text-gray-400 font-medium">Aisha's request: Minimizes transfer transactions.</p>
                </div>
                <Link 
                  to="/explain-balance" 
                  className="text-xs font-bold text-brand-primary hover:text-indigo-700 flex items-center gap-1 transition-colors"
                >
                  View Details
                  <ArrowRight size={14} />
                </Link>
              </div>

              {balances.simplified_debts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="bg-green-50 text-brand-success p-3 rounded-full mb-3">
                    <CheckCircle2 size={24} />
                  </div>
                  <h4 className="font-bold text-gray-900 text-sm">Everyone is Settled Up!</h4>
                  <p className="text-xs text-gray-400 mt-1">No pending simplified debts exist in this group.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto pr-1">
                  {balances.simplified_debts.map((debt: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-red-50 text-brand-danger flex items-center justify-center text-xs font-bold">
                          {debt.from_member_name[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{debt.from_member_name}</p>
                          <span className="text-[10px] text-gray-400 font-medium uppercase">Debtor</span>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-center justify-center text-gray-400">
                        <span className="text-xs font-bold text-brand-primary bg-indigo-50/60 px-2 py-0.5 rounded-full mb-1">
                          ₹{debt.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </span>
                        <div className="flex items-center gap-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-primary"></span>
                          <span className="w-6 h-0.5 bg-gray-200"></span>
                          <ArrowRightLeft size={10} className="text-gray-300" />
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-900">{debt.to_member_name}</p>
                          <span className="text-[10px] text-gray-400 font-medium uppercase">Creditor</span>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-green-50 text-brand-success flex items-center justify-center text-xs font-bold">
                          {debt.to_member_name[0].toUpperCase()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Quick Audits & Actions */}
            <div className="space-y-6">
              
              {/* Data Import Card */}
              <div className="bg-gradient-to-tr from-brand-primary to-indigo-700 text-white rounded-2xl p-6 shadow-md shadow-indigo-100 flex flex-col justify-between h-48">
                <div>
                  <div className="bg-white/10 p-2 rounded-lg w-max mb-3">
                    <FileSpreadsheet size={20} />
                  </div>
                  <h4 className="font-bold text-lg leading-tight">Spreadsheet Data Import</h4>
                  <p className="text-white/80 text-xs mt-1.5">Ingest roommate spreadsheets with validation rules.</p>
                </div>
                <Link
                  to="/import"
                  className="bg-white hover:bg-gray-50 text-brand-primary rounded-xl px-4 py-2.5 text-xs font-bold w-full text-center block transition-all shadow"
                >
                  Upload CSV Export
                </Link>
              </div>

              {/* Pending Anomaly Alert Action */}
              <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${pendingAnomaliesCount > 0 ? 'bg-red-50 text-brand-danger animate-pulse' : 'bg-gray-50 text-gray-400'}`}>
                    <AlertCircle size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-gray-900">Audit Center</h4>
                    <p className="text-xs text-gray-400">{pendingAnomaliesCount} items require review</p>
                  </div>
                </div>

                {pendingAnomaliesCount > 0 ? (
                  <>
                    <div className="bg-red-50/50 border border-red-100 rounded-xl p-3 text-xs text-red-800 leading-snug">
                      <strong>Unresolved issues</strong> exist regarding duplicate entries, USD conversion rates, and member timelines.
                    </div>
                    <Link
                      to="/audit"
                      className="text-xs font-bold text-brand-danger hover:text-red-700 flex items-center gap-1"
                    >
                      Resolve Anomalies Queue
                      <ArrowRight size={14} />
                    </Link>
                  </>
                ) : (
                  <div className="text-xs text-gray-400 flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-brand-success" />
                    All records certified and clean.
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
