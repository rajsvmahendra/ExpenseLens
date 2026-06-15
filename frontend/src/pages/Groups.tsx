import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Calendar, 
  UserPlus, 
  Clock, 
  CheckCircle,
  HelpCircle,
  Plus,
  ShieldCheck,
  CalendarDays
} from 'lucide-react';
import { api } from '../services/api';

export default function Groups() {
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [memberships, setMemberships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New member inputs
  const [newMemberName, setNewMemberName] = useState('');
  const [joinDate, setJoinDate] = useState('2026-03-01');
  const [leaveDate, setLeaveDate] = useState('');
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');
  const [adding, setAdding] = useState(false);

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
    loadMembers();
  }, [selectedGroupId]);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const data = await api.memberships.list(selectedGroupId);
      setMemberships(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim() || !joinDate) {
      setAddError('Please fill in name and join date.');
      return;
    }

    setAddError('');
    setAddSuccess('');
    setAdding(true);
    try {
      await api.memberships.create({
        group: selectedGroupId,
        name: newMemberName,
        joined_at: joinDate,
        left_at: leaveDate || null
      });
      setAddSuccess(`Member ${newMemberName} added successfully.`);
      setNewMemberName('');
      setLeaveDate('');
      await loadMembers();
    } catch (err: any) {
      setAddError(err.message || 'Failed to add member.');
    } finally {
      setAdding(false);
    }
  };

  const handleUpdateLeaveDate = async (memberId: string, lDate: string) => {
    try {
      await api.memberships.update(memberId, { left_at: lDate || null });
      await loadMembers();
    } catch (e) {
      console.error(e);
    }
  };

  // Timeline representation helper:
  // We plot dates for March & April 2026 (the main spreadsheet scope)
  // March: 31 days. April: 30 days. Total: 61 days.
  const getTimelineBarStyles = (joinedStr: string, leftStr: string | null) => {
    const startLimit = new Date('2026-03-01').getTime();
    const endLimit = new Date('2026-04-30').getTime();
    const totalDuration = endLimit - startLimit;

    const joinedTime = new Date(joinedStr).getTime();
    const leftTime = leftStr ? new Date(leftStr).getTime() : endLimit;

    // Constrain within March/April 2026 for visual plotting
    const plotStart = Math.max(startLimit, Math.min(endLimit, joinedTime));
    const plotEnd = Math.max(startLimit, Math.min(endLimit, leftTime));

    const leftPercent = ((plotStart - startLimit) / totalDuration) * 100;
    const widthPercent = ((plotEnd - plotStart) / totalDuration) * 100;

    return {
      left: `${leftPercent}%`,
      width: `${widthPercent}%`
    };
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-950 tracking-tight">Groups & Membership Timelines</h2>
          <p className="text-sm text-gray-400 mt-1 font-medium">Verify roommate join and leave dates. Equal splits automatically ignore inactive periods.</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left 2/3: Roommate List & Timeline Gantt Plot */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Members Table */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-gray-50 pb-4">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-brand-primary" />
                <h3 className="font-bold text-gray-900 text-sm">Roommates & Active Periods</h3>
              </div>
              <span className="text-xs text-gray-400 font-semibold">{memberships.length} Total Members</span>
            </div>

            {loading ? (
              <p className="text-xs text-gray-400 text-center py-6">Loading members...</p>
            ) : (
              <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs divide-y divide-gray-100">
                  <thead className="bg-gray-50/70 font-semibold text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Roommate Name</th>
                      <th className="px-4 py-3">Join Date</th>
                      <th className="px-4 py-3">Leave Date</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Quick Edit Leave</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white font-medium text-gray-700">
                    {memberships.map((m) => (
                      <tr key={m.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3 font-bold text-gray-900 flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-indigo-50 text-brand-primary flex items-center justify-center font-bold text-[10px]">
                            {m.name[0]}
                          </div>
                          {m.name}
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          <span className="flex items-center gap-1"><Calendar size={12}/> {m.joined_at}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {m.left_at ? (
                            <span className="flex items-center gap-1 text-red-500"><Calendar size={12}/> {m.left_at}</span>
                          ) : (
                            <span className="text-brand-success font-bold flex items-center gap-1"><ShieldCheck size={12}/> Active</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            !m.left_at ? 'bg-green-50 text-brand-success' : 'bg-red-50 text-brand-danger'
                          }`}>
                            {!m.left_at ? 'IN GROUP' : 'DEPARTED'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <input 
                            type="date"
                            value={m.left_at || ''}
                            onChange={(e) => handleUpdateLeaveDate(m.id, e.target.value)}
                            className="bg-gray-50 border border-gray-150 rounded px-2 py-1 text-[11px] outline-none"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Timeline Gantt Chart Visualizer */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex items-center gap-2 border-b border-gray-50 pb-4">
              <CalendarDays size={18} className="text-brand-accent" />
              <h3 className="font-bold text-gray-900 text-sm">Visual Membership Timeline Map (March - April 2026)</h3>
            </div>

            <div className="space-y-4 pt-2">
              {/* Gantt Header months */}
              <div className="flex text-[10px] text-gray-400 font-bold uppercase tracking-wider relative border-b border-gray-100 pb-2">
                <div className="w-1/2">March 2026</div>
                <div className="w-1/2 border-l border-gray-100 pl-3">April 2026</div>
              </div>

              {/* Members Bars */}
              <div className="space-y-4">
                {memberships.map((m) => {
                  const barStyle = getTimelineBarStyles(m.joined_at, m.left_at);
                  return (
                    <div key={m.id} className="flex items-center gap-4 text-xs font-semibold">
                      {/* Name tag */}
                      <span className="w-16 truncate text-gray-700 font-bold text-right shrink-0">{m.name}</span>
                      
                      {/* Timeline Lane */}
                      <div className="flex-1 bg-gray-50 h-5 rounded-lg relative overflow-hidden border border-gray-100">
                        {/* Selected Member Bar */}
                        <div 
                          className="absolute h-full rounded-md bg-gradient-to-r from-brand-primary to-brand-secondary/80 flex items-center px-2 text-[9px] text-white font-bold opacity-90 shadow-sm"
                          style={barStyle}
                        >
                          <span className="truncate">{m.joined_at} {m.left_at ? `to ${m.left_at}` : '-> Present'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footnotes validating characters date ranges */}
              <div className="bg-amber-50/20 border border-amber-100/50 rounded-xl p-3.5 text-[11px] text-amber-800 leading-normal space-y-1 mt-6">
                <strong>Internship Audit dates configured:</strong>
                <ul className="list-disc pl-4 space-y-0.5 mt-1 font-medium text-gray-600">
                  <li><strong>Meera</strong>: Left at end of March (March 31). Auto-excluded from April transactions.</li>
                  <li><strong>Sam</strong>: Joined mid-April (April 15). Auto-excluded from March transactions.</li>
                  <li><strong>Dev</strong>: Joined for trip (March 15). Participates in USD expenses.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1/3: Add Member Card */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm h-max space-y-5">
          <div className="flex items-center gap-2 border-b border-gray-50 pb-3">
            <UserPlus size={16} className="text-gray-400" />
            <h3 className="font-bold text-gray-900 text-sm">Add Roommate</h3>
          </div>

          <form onSubmit={handleAddMember} className="space-y-4">
            {addError && (
              <div className="bg-red-50 border border-red-100 text-brand-danger text-xs font-semibold rounded-xl p-3">
                {addError}
              </div>
            )}
            
            {addSuccess && (
              <div className="bg-green-50 border border-green-100 text-brand-success text-xs font-semibold rounded-xl p-3">
                {addSuccess}
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Member Name</label>
              <input
                type="text"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                placeholder="e.g. Sam, Meera"
                className="w-full bg-gray-50/50 border border-gray-100 focus:border-brand-primary focus:bg-white rounded-xl px-3 py-2 text-xs outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Joined Date</label>
              <input
                type="date"
                value={joinDate}
                onChange={(e) => setJoinDate(e.target.value)}
                className="w-full bg-gray-50/50 border border-gray-100 focus:border-brand-primary focus:bg-white rounded-xl px-3 py-2 text-xs outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Leave Date (Optional)</label>
              <input
                type="date"
                value={leaveDate}
                onChange={(e) => setLeaveDate(e.target.value)}
                className="w-full bg-gray-50/50 border border-gray-100 focus:border-brand-primary focus:bg-white rounded-xl px-3 py-2 text-xs outline-none transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={adding}
              className="w-full bg-brand-primary hover:bg-indigo-600 text-white rounded-xl py-2.5 text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
            >
              <Plus size={14} />
              {adding ? 'Adding...' : 'Add Member'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
