import React, { useState, useEffect } from 'react';
import { 
  Receipt, 
  Plus, 
  Trash2, 
  Info, 
  Calendar, 
  User, 
  Coins, 
  X,
  AlertTriangle,
  ChevronRight,
  TrendingDown
} from 'lucide-react';
import { api } from '../services/api';

export default function Expenses() {
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [expenses, setExpenses] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Detail Drawer State
  const [activeExpense, setActiveExpense] = useState<any>(null);

  // Add Expense Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [paidBy, setPaidBy] = useState('');
  const [expenseDate, setExpenseDate] = useState('2026-03-15');
  const [splitType, setSplitType] = useState('EQUAL');
  
  // Custom Splits values state: memberId -> value string
  const [customSplitVals, setCustomSplitVals] = useState<Record<string, string>>({});
  const [modalError, setModalError] = useState('');
  const [creating, setCreating] = useState(false);

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
    loadExpensesAndMembers();
  }, [selectedGroupId]);

  const loadExpensesAndMembers = async () => {
    setLoading(true);
    try {
      const [expList, memList] = await Promise.all([
        api.expenses.list(selectedGroupId),
        api.memberships.list(selectedGroupId)
      ]);
      setExpenses(expList.filter((e: any) => !e.is_settlement_hidden));
      setMembers(memList);
      if (memList.length > 0) {
        setPaidBy(memList[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExpense = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent opening drawer
    if (!confirm('Are you sure you want to delete this expense?')) return;
    
    try {
      await api.expenses.delete(id);
      await loadExpensesAndMembers();
      if (activeExpense?.id === id) {
        setActiveExpense(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenAddModal = () => {
    setDescription('');
    setAmount('');
    setCurrency('INR');
    setSplitType('EQUAL');
    setModalError('');
    
    const defaults: Record<string, string> = {};
    members.forEach(m => {
      defaults[m.id] = '';
    });
    setCustomSplitVals(defaults);
    
    if (members.length > 0) {
      setPaidBy(members[0].id);
    }
    setShowAddModal(true);
  };

  const handleCloseAddModal = () => {
    setShowAddModal(false);
  };

  const handleCustomSplitChange = (memberId: string, val: string) => {
    setCustomSplitVals(prev => ({
      ...prev,
      [memberId]: val
    }));
  };

  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !amount || !expenseDate) {
      setModalError('Please fill in all core fields.');
      return;
    }

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      setModalError('Please enter a positive numeric amount.');
      return;
    }

    // Build custom splits payload if not equal
    const splitsPayload: any[] = [];
    if (splitType !== 'EQUAL') {
      let sum = 0;
      for (const m of members) {
        const strVal = customSplitVals[m.id] || '0';
        const floatVal = parseFloat(strVal);
        if (isNaN(floatVal) || floatVal < 0) {
          setModalError(`Invalid split value for member ${m.name}`);
          return;
        }
        sum += floatVal;
        if (floatVal > 0) {
          splitsPayload.push({
            member: m.id,
            value: floatVal
          });
        }
      }

      if (splitsPayload.length === 0) {
        setModalError('Please configure at least one split ratio/amount.');
        return;
      }

      if (splitType === 'PERCENTAGE' && Math.abs(sum - 100) > 0.1) {
        // We allow submission but backend anomalies check will flag SPLIT_SUM_MISMATCH
        console.warn("Percentages sum does not equal 100: ", sum);
      }
    }

    setCreating(true);
    setModalError('');
    try {
      await api.expenses.create({
        group: selectedGroupId,
        paid_by: paidBy,
        description: description,
        amount_original: amt,
        currency_original: currency,
        expense_date: expenseDate,
        split_type: splitType,
        splits: splitsPayload
      });
      await loadExpensesAndMembers();
      handleCloseAddModal();
    } catch (err: any) {
      setModalError(err.message || 'Failed to save expense.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto flex h-full gap-8 relative">
      
      {/* Left Area: Main Expense Table (Takes full width unless drawer is open, then 2/3) */}
      <div className={`flex-1 space-y-6 transition-all duration-300 ${activeExpense ? 'lg:max-w-[65%]' : 'w-full'}`}>
        
        {/* Header toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-gray-950 tracking-tight">Expenses Management</h2>
            <p className="text-sm text-gray-400 mt-1 font-medium">Add, review, and audit group expenses. Integrates automated split calculators.</p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenAddModal}
              className="bg-brand-primary hover:bg-indigo-600 text-white rounded-xl px-5 py-2.5 text-xs font-bold shadow-md shadow-indigo-100 flex items-center gap-1.5 transition-all duration-150 shrink-0"
            >
              <Plus size={14} />
              Add Expense
            </button>
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

        {/* Expenses List Table */}
        {loading ? (
          <div className="space-y-4 animate-pulse">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white border border-gray-50 rounded-2xl h-14"></div>
            ))}
          </div>
        ) : expenses.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm flex flex-col items-center justify-center">
            <Receipt size={48} className="text-gray-300 mb-4" />
            <h3 className="font-bold text-gray-900 text-base">No Expenses Found</h3>
            <p className="text-xs text-gray-400 mt-1 max-w-sm">
              Log your first group expense manually or upload a CSV export to automatically generate splits.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs divide-y divide-gray-100">
                <thead className="bg-gray-50/70 font-semibold text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Date</th>
                    <th className="px-6 py-3.5">Description</th>
                    <th className="px-6 py-3.5">Paid By</th>
                    <th className="px-6 py-3.5 text-right">Original Amt</th>
                    <th className="px-6 py-3.5 text-right">Base Amt (INR)</th>
                    <th className="px-6 py-3.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white font-medium text-gray-700">
                  {expenses.map((e) => (
                    <tr 
                      key={e.id} 
                      onClick={() => setActiveExpense(e)}
                      className={`hover:bg-gray-50/50 transition-colors cursor-pointer ${
                        activeExpense?.id === e.id ? 'bg-indigo-50/15' : ''
                      }`}
                    >
                      <td className="px-6 py-4 text-gray-400 font-semibold whitespace-nowrap">
                        <span className="flex items-center gap-1.5"><Calendar size={12}/> {e.expense_date}</span>
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-950 max-w-[200px] truncate" title={e.description}>
                        {e.description}
                      </td>
                      <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                        <span className="flex items-center gap-1.5"><User size={12}/> {e.paid_by_name}</span>
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-gray-500 whitespace-nowrap">
                        {e.currency_original} {Number(e.amount_original).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-right font-extrabold text-gray-900 whitespace-nowrap">
                        ₹{Number(e.amount_base).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        <button
                          onClick={(evt) => handleDeleteExpense(e.id, evt)}
                          className="text-gray-400 hover:text-brand-danger transition-colors p-1.5 hover:bg-red-50 rounded-lg"
                          title="Delete Expense"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Right Area: Interactive Detail Drawer */}
      {activeExpense && (
        <div className="hidden lg:block w-[35%] bg-white border border-gray-100 rounded-2xl shadow-xl p-6 space-y-6 h-max shrink-0 sticky top-4 animate-slide-in">
          {/* Drawer Header */}
          <div className="flex items-center justify-between border-b border-gray-50 pb-4">
            <div>
              <span className="bg-indigo-50 text-brand-primary text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border border-indigo-100">
                Split Audit Drawer
              </span>
              <h3 className="font-extrabold text-gray-950 text-base mt-2">{activeExpense.description}</h3>
            </div>
            <button 
              onClick={() => setActiveExpense(null)}
              className="text-gray-400 hover:text-gray-900 p-1.5 hover:bg-gray-50 rounded-lg"
            >
              <X size={18} />
            </button>
          </div>

          {/* Core Info */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
              <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-50">
                <span className="block text-[9px] text-gray-400 font-bold uppercase">Date</span>
                <span className="text-gray-800">{activeExpense.expense_date}</span>
              </div>
              <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-50">
                <span className="block text-[9px] text-gray-400 font-bold uppercase">Payer</span>
                <span className="text-gray-800">{activeExpense.paid_by_name}</span>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 border border-gray-50 flex items-center justify-between">
              <div>
                <span className="block text-[9px] text-gray-400 font-bold uppercase">Amount Total (Original)</span>
                <span className="text-sm font-bold text-gray-900">{activeExpense.currency_original} {activeExpense.amount_original}</span>
              </div>
              <ChevronRight className="text-gray-300" size={16} />
              <div className="text-right">
                <span className="block text-[9px] text-gray-400 font-bold uppercase">Base Converted (INR)</span>
                <span className="text-sm font-extrabold text-indigo-600">₹{Number(activeExpense.amount_base).toFixed(2)}</span>
              </div>
            </div>
            
            {activeExpense.currency_original !== 'INR' && (
              <div className="bg-indigo-50/30 text-indigo-700 rounded-xl p-3 border border-indigo-100/50 text-[10px] leading-relaxed flex items-start gap-2">
                <Coins size={14} className="shrink-0 mt-0.5" />
                <span>
                  USD conversion rate applied: <strong>1 USD = {activeExpense.exchange_rate} INR</strong> based on historical rates.
                </span>
              </div>
            )}
          </div>

          {/* Splits Breakdown */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Calculated Split Shares</h4>
            <div className="divide-y divide-gray-50 border border-gray-50 rounded-xl overflow-hidden bg-gray-50/20 px-3.5 py-1">
              {activeExpense.splits.map((s: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-3 text-xs font-medium first:pt-2 last:pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-5.5 h-5.5 rounded-full bg-gray-100 text-gray-600 font-bold text-[9px] flex items-center justify-center">
                      {s.member_name[0]}
                    </div>
                    <span className="text-gray-800 font-bold">{s.member_name}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-extrabold text-gray-950">₹{s.calculated_amount.toFixed(2)}</span>
                    <span className="block text-[9px] text-gray-400 font-semibold">{s.split_type} ({s.value})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 relative animate-slide-in border border-gray-100 max-h-[90vh] overflow-y-auto">
            {/* Modal Close */}
            <button 
              onClick={handleCloseAddModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-900 p-1.5 hover:bg-gray-100 rounded-lg"
            >
              <X size={20} />
            </button>

            {/* Modal Header */}
            <div className="mb-6">
              <span className="bg-indigo-50 text-brand-primary text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider border border-indigo-100">
                Expense Creation Wizard
              </span>
              <h3 className="text-base font-extrabold text-gray-950 mt-2.5">Create New Group Expense</h3>
            </div>

            <form onSubmit={handleSubmitExpense} className="space-y-4">
              
              {modalError && (
                <div className="bg-red-50 border border-red-100 text-brand-danger text-xs font-semibold rounded-xl p-3">
                  {modalError}
                </div>
              )}

              {/* Core fields grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Description</label>
                  <input
                    type="text"
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Dinner taxi"
                    className="w-full bg-gray-50/50 border border-gray-150 focus:border-brand-primary focus:bg-white rounded-xl px-3 py-2 text-xs outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Date</label>
                  <input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full bg-gray-50/50 border border-gray-150 focus:border-brand-primary focus:bg-white rounded-xl px-3 py-2 text-xs outline-none transition-all"
                  />
                </div>
              </div>

              {/* Amount & Payer grid */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Original Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="3000.00"
                    className="w-full bg-gray-50/50 border border-gray-150 focus:border-brand-primary focus:bg-white rounded-xl px-3 py-2 text-xs outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full bg-gray-50/50 border border-gray-150 focus:border-brand-primary focus:bg-white rounded-xl px-3 py-2 text-xs outline-none transition-all cursor-pointer"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Paid By</label>
                  <select
                    value={paidBy}
                    onChange={(e) => setPaidBy(e.target.value)}
                    className="w-full bg-gray-50/50 border border-gray-150 focus:border-brand-primary focus:bg-white rounded-xl px-3 py-2 text-xs outline-none transition-all cursor-pointer"
                  >
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Split Type Selector */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Split Calculation Type</label>
                <div className="grid grid-cols-4 gap-2">
                  {['EQUAL', 'PERCENTAGE', 'SHARE', 'EXACT'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setSplitType(type)}
                      className={`py-2 rounded-lg text-[10px] font-bold border transition-all ${
                        splitType === type
                          ? 'border-brand-primary bg-indigo-50/20 text-brand-primary'
                          : 'border-gray-100 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Split Inputs (If not EQUAL) */}
              {splitType !== 'EQUAL' && (
                <div className="space-y-3 bg-gray-50/30 border border-gray-100 rounded-xl p-4">
                  <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider pb-1">
                    <span>Roommate</span>
                    <span>{splitType === 'PERCENTAGE' ? 'Percentage (%)' : (splitType === 'SHARE' ? 'Shares Count' : 'Exact Amount (INR)')}</span>
                  </div>
                  
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {members.map(m => (
                      <div key={m.id} className="flex items-center justify-between text-xs font-semibold">
                        <span>{m.name}</span>
                        <input
                          type="number"
                          step="any"
                          value={customSplitVals[m.id] || ''}
                          onChange={(e) => handleCustomSplitChange(m.id, e.target.value)}
                          placeholder="0"
                          className="w-24 bg-white border border-gray-150 rounded px-2.5 py-1 text-xs outline-none text-right focus:border-brand-primary"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-50">
                <button
                  type="button"
                  onClick={handleCloseAddModal}
                  className="px-4 py-2.5 rounded-xl border border-gray-100 hover:bg-gray-50 text-xs font-semibold text-gray-500 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="bg-brand-primary hover:bg-indigo-600 text-white rounded-xl px-5 py-2.5 text-xs font-bold shadow-md shadow-indigo-100 transition-all disabled:opacity-50"
                >
                  {creating ? 'Saving...' : 'Add Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
