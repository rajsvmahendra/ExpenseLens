import React, { useState, useEffect } from 'react';
import { 
  History, 
  User, 
  Calendar, 
  Tag, 
  ShieldCheck,
  Search
} from 'lucide-react';
import { api } from '../services/api';

export default function DecisionTrail() {
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [decisions, setDecisions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

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
    loadDecisions();
  }, [selectedGroupId]);

  const loadDecisions = async () => {
    setLoading(true);
    try {
      const data = await api.decisions.list(selectedGroupId);
      setDecisions(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filteredDecisions = decisions.filter(d => {
    const term = searchQuery.toLowerCase().trim();
    if (!term) return true;
    return (
      d.action.toLowerCase().includes(term) ||
      d.reasoning.toLowerCase().includes(term) ||
      d.user_name.toLowerCase().includes(term) ||
      d.target_object_type.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-950 tracking-tight">Decision Trail Logs</h2>
          <p className="text-sm text-gray-400 mt-1 font-medium">Immutable chronological registry of all administrative adjustments, merges, and overrides.</p>
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

      {/* Filter toolbar */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-3">
        <Search size={16} className="text-gray-400 shrink-0" />
        <input
          type="text"
          placeholder="Filter decisions by operator, action keyword, or reasoning text..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-transparent border-none outline-none text-xs w-full text-gray-700 placeholder-gray-400 font-medium"
        />
      </div>

      {/* Decisions Timeline List */}
      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white border border-gray-50 rounded-2xl h-24"></div>
          ))}
        </div>
      ) : filteredDecisions.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm flex flex-col items-center justify-center">
          <History size={48} className="text-gray-300 mb-4" />
          <h3 className="font-bold text-gray-900 text-base">No Actions Logged</h3>
          <p className="text-xs text-gray-400 mt-1 max-w-sm">
            The decision trail is empty. Any future merges, overrides, and CSV uploads will be chronologically documented here.
          </p>
        </div>
      ) : (
        <div className="relative border-l border-gray-100 ml-4 pl-6 space-y-6">
          {filteredDecisions.map((decision) => (
            <div key={decision.id} className="relative space-y-2">
              
              {/* Timeline Bullet Node */}
              <span className="absolute left-[-31px] top-1.5 w-4 h-4 rounded-full bg-brand-primary border-4 border-white shadow"></span>

              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-50 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-brand-primary bg-indigo-50/70 border border-indigo-100/50 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider text-[10px]">
                      {decision.action.replace(/RESOLVE_/g, '')}
                    </span>
                    <span className="text-[10px] text-gray-400 font-semibold">Target: {decision.target_object_type}</span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-[10px] text-gray-400 font-semibold">
                    <span className="flex items-center gap-1"><User size={12}/> Operator: {decision.user_name}</span>
                    <span className="flex items-center gap-1"><Calendar size={12}/> {new Date(decision.timestamp).toLocaleString()}</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider">Justified Reasoning</span>
                  <p className="text-xs text-gray-700 font-medium leading-relaxed bg-gray-50/40 border border-gray-50 p-3 rounded-xl italic">
                    "{decision.reasoning}"
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
