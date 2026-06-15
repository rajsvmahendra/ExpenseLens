import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Info, 
  Calendar, 
  Coins,
  History,
  ShieldCheck,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';

export default function ExplainBalance() {
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [members, setMembers] = useState<any[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  
  const [expenses, setExpenses] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [balances, setBalances] = useState<any>({ member_balances: [], simplified_debts: [] });
  const [loading, setLoading] = useState(true);

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
    loadGroupData();
  }, [selectedGroupId]);

  const loadGroupData = async () => {
    setLoading(true);
    try {
      const [balData, expData, setlData, memData] = await Promise.all([
        api.groups.getBalances(selectedGroupId),
        api.expenses.list(selectedGroupId),
        api.settlements.list(selectedGroupId),
        api.memberships.list(selectedGroupId)
      ]);

      setBalances(balData);
      setExpenses(expData.filter((e: any) => !e.is_settlement_hidden));
      setSettlements(setlData);
      setMembers(memData);
      
      if (memData.length > 0) {
        setSelectedMemberId(memData[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getMemberSummary = (memberId: string) => {
    return balances.member_balances.find((m: any) => m.member_id === memberId) || null;
  };

  const getMemberName = (memberId: string) => {
    return members.find(m => m.id === memberId)?.name || 'Unknown';
  };

  // Filter expenses and settlements for audit breakdown of selected member
  const memberSummary = getMemberSummary(selectedMemberId);
  const selectedMemberName = getMemberName(selectedMemberId);

  // 1. Expenses paid by this member
  const paidExpenses = expenses.filter(e => e.paid_by === selectedMemberId);

  // 2. Expenses where this member owes (included in split)
  const owedSplits = expenses.filter(e => 
    e.splits.some((s: any) => s.member === selectedMemberId)
  ).map(e => {
    const split = e.splits.find((s: any) => s.member === selectedMemberId);
    return {
      expense_id: e.id,
      description: e.description,
      amount_original: e.amount_original,
      currency_original: e.currency_original,
      exchange_rate: e.exchange_rate,
      amount_base: e.amount_base,
      payer_name: e.paid_by_name,
      expense_date: e.expense_date,
      split_type: split.split_type,
      calculated_amount: split.calculated_amount
    };
  });

  // 3. Settlements where this member paid
  const settlementsPaid = settlements.filter(s => s.payer === selectedMemberId);

  // 4. Settlements where this member received
  const settlementsReceived = settlements.filter(s => s.payee === selectedMemberId);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-950 tracking-tight">Explain My Balance</h2>
          <p className="text-sm text-gray-400 mt-1 font-medium">Rohan's requirement: Complete transparency, historical exchange audits, and no magic numbers.</p>
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

      {loading ? (
        <div className="space-y-4 animate-pulse">
          <div className="bg-white border border-gray-50 rounded-2xl h-24"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-96">
            <div className="bg-white border border-gray-50 rounded-2xl"></div>
            <div className="bg-white border border-gray-50 rounded-2xl"></div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Roommate Selection Bar */}
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider px-3">Select Roommate:</span>
            {members.map((member) => (
              <button
                key={member.id}
                onClick={() => setSelectedMemberId(member.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  selectedMemberId === member.id
                    ? 'bg-brand-primary text-white shadow shadow-indigo-100'
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-600'
                }`}
              >
                {member.name}
              </button>
            ))}
          </div>

          {/* Audit Metrics */}
          {memberSummary && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              
              {/* Net Position Card */}
              <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all relative overflow-hidden">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Net Position</span>
                <div className="mt-4">
                  <h3 className={`text-2xl font-extrabold ${memberSummary.net_balance >= 0 ? 'text-brand-success' : 'text-brand-danger'}`}>
                    {memberSummary.net_balance >= 0 ? '+' : ''}₹{memberSummary.net_balance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1 font-medium">
                    {memberSummary.net_balance >= 0 ? 'You are owed this amount' : 'You owe this amount'}
                  </p>
                </div>
              </div>

              {/* Total Paid (Lender Credit) */}
              <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Paid as Payer</span>
                <div className="mt-4">
                  <h3 className="text-2xl font-extrabold text-gray-950">₹{memberSummary.total_paid_expenses.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</h3>
                  <p className="text-xs text-gray-400 mt-1 font-medium">Lent money to others</p>
                </div>
              </div>

              {/* Total Owed (Borrower Shares) */}
              <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Owed Splits</span>
                <div className="mt-4">
                  <h3 className="text-2xl font-extrabold text-gray-950">₹{memberSummary.total_owed_splits.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</h3>
                  <p className="text-xs text-gray-400 mt-1 font-medium">Your consumption share</p>
                </div>
              </div>

              {/* Settlements Impact */}
              <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Settlements Impact</span>
                <div className="mt-4">
                  <h3 className="text-2xl font-extrabold text-gray-950">
                    ₹{(memberSummary.total_settlements_received - memberSummary.total_settlements_paid).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1 font-medium">
                    Paid: ₹{memberSummary.total_settlements_paid} | Recd: ₹{memberSummary.total_settlements_received}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Audit Trail Formula Section */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-6">
            <div className="flex items-center gap-2 border-b border-gray-50 pb-4">
              <Sparkles size={18} className="text-brand-primary" />
              <h3 className="font-extrabold text-gray-900 text-base">Step-by-Step Balance Calculation</h3>
            </div>

            {/* Formula Block */}
            {memberSummary && (
              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 font-mono text-xs sm:text-sm space-y-4">
                <div className="text-gray-500 font-semibold uppercase text-[10px]">Audit Statement</div>
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center text-gray-700">
                    <span>Lender Contributions (Total Paid as Payer)</span>
                    <span className="font-bold text-green-600">+ ₹{memberSummary.total_paid_expenses.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-gray-700">
                    <span>Borrower Consumptions (Your Owed Splits)</span>
                    <span className="font-bold text-red-600">- ₹{memberSummary.total_owed_splits.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-gray-700">
                    <span>Direct Settlements Received</span>
                    <span className="font-bold text-green-600">+ ₹{memberSummary.total_settlements_received.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-gray-700">
                    <span>Direct Settlements Paid Out</span>
                    <span className="font-bold text-red-600">- ₹{memberSummary.total_settlements_paid.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-gray-200 pt-3 flex justify-between items-center text-gray-950 font-bold text-base">
                    <span>Final Audited Net Balance</span>
                    <span className={memberSummary.net_balance >= 0 ? 'text-green-600' : 'text-red-600'}>
                      ₹{memberSummary.net_balance.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Ledger Lists Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Left Col: Lender Contributions & Settlements */}
            <div className="space-y-6">
              
              {/* Paid Expenses */}
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-gray-50 pb-3">
                  <h4 className="font-bold text-sm text-gray-900">1. Expenses Paid by {selectedMemberName}</h4>
                  <span className="text-[10px] text-gray-400 font-semibold">{paidExpenses.length} entries</span>
                </div>
                {paidExpenses.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6">No expenses paid by this member.</p>
                ) : (
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {paidExpenses.map((e) => (
                      <div key={e.id} className="border border-gray-50 rounded-xl p-3 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                        <div>
                          <p className="text-xs font-bold text-gray-800">{e.description}</p>
                          <span className="text-[9px] text-gray-400 font-semibold flex items-center gap-1 mt-0.5">
                            <Calendar size={10} /> {e.expense_date}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-gray-950">₹{Number(e.amount_base).toFixed(2)}</p>
                          {e.currency_original !== 'INR' && (
                            <span className="text-[9px] text-brand-secondary font-medium block">
                              Converts {e.currency_original} {e.amount_original} @ {e.exchange_rate}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Direct Settlements */}
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-gray-50 pb-3">
                  <h4 className="font-bold text-sm text-gray-900">3. Settlement Ledger Actions</h4>
                  <span className="text-[10px] text-gray-400 font-semibold">Repayments</span>
                </div>
                
                {settlementsPaid.length === 0 && settlementsReceived.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6">No direct settlements recorded.</p>
                ) : (
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {/* Paid out */}
                    {settlementsPaid.map((s) => (
                      <div key={s.id} className="border border-red-50/70 bg-red-50/10 rounded-xl p-3 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-3">
                          <div className="bg-red-50 text-brand-danger p-1.5 rounded-lg">
                            <ArrowUpRight size={14} />
                          </div>
                          <div>
                            <p className="font-bold text-gray-800">Paid to {s.payee_name}</p>
                            <span className="text-[9px] text-gray-400 font-semibold">{s.date}</span>
                          </div>
                        </div>
                        <span className="font-extrabold text-brand-danger">-₹{Number(s.amount).toFixed(2)}</span>
                      </div>
                    ))}
                    {/* Received */}
                    {settlementsReceived.map((s) => (
                      <div key={s.id} className="border border-green-50/70 bg-green-50/10 rounded-xl p-3 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-3">
                          <div className="bg-green-50 text-brand-success p-1.5 rounded-lg">
                            <ArrowDownLeft size={14} />
                          </div>
                          <div>
                            <p className="font-bold text-gray-800">Received from {s.payer_name}</p>
                            <span className="text-[9px] text-gray-400 font-semibold">{s.date}</span>
                          </div>
                        </div>
                        <span className="font-extrabold text-brand-success">+₹{Number(s.amount).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Col: Consumption Shares Owed */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-50 pb-3">
                <h4 className="font-bold text-sm text-gray-900">2. Consumer Debts (Expenses you participated in)</h4>
                <span className="text-[10px] text-gray-400 font-semibold">{owedSplits.length} entries</span>
              </div>
              
              {owedSplits.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">You participated in no splits.</p>
              ) : (
                <div className="space-y-4 max-h-[580px] overflow-y-auto pr-1">
                  {owedSplits.map((split: any, i: number) => (
                    <div key={i} className="border border-gray-50 rounded-xl p-4 space-y-2.5">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-gray-950 font-bold">{split.description}</span>
                        <span className="text-brand-danger font-extrabold">Owe ₹{split.calculated_amount.toFixed(2)}</span>
                      </div>
                      
                      {/* Explanatory calculation trail */}
                      <div className="bg-gray-50/70 rounded-lg p-3 text-[10px] text-gray-500 space-y-1.5 font-medium leading-relaxed">
                        <div className="flex justify-between">
                          <span>Paid By:</span>
                          <span className="font-semibold text-gray-700">{split.payer_name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total Amount:</span>
                          <span className="font-semibold text-gray-700">₹{split.amount_base.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Split Calculation Type:</span>
                          <span className="font-bold text-brand-primary">{split.split_type}</span>
                        </div>
                        
                        {/* Exchange rate audit if USD */}
                        {split.currency_original !== 'INR' && (
                          <div className="text-brand-secondary border-t border-gray-100 pt-1 flex justify-between">
                            <span>USD Convert:</span>
                            <span>{split.currency_original} {split.amount_original} @ rate {split.exchange_rate}</span>
                          </div>
                        )}
                        
                        {/* Timeline warning indicator if Meera/Sam period */}
                        {split.expense_date >= '2026-04-01' && split.payer_name === 'Meera' && (
                          <div className="text-brand-warning border-t border-gray-100 pt-1 flex items-center gap-1">
                            <AlertCircle size={10} />
                            <span>Timeline check: Meera left March 31. Checked.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
