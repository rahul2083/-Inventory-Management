import React, { useState, useEffect, useMemo } from 'react';
import { printerService } from '../services/api';
import { History, Filter, X, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export default function UserActivity() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ user: '', role: '', date: '' });

  useEffect(() => {
    async function fetchLogs() {
      try {
        const data = await printerService.getActivityLogs();
        setLogs(data);
      } catch (error) {
        console.error("Failed to fetch activity logs", error);
      } finally {
        setLoading(false);
      }
    }
    fetchLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const userMatch = !filters.user || log.username.toLowerCase().includes(filters.user.toLowerCase());
      const roleMatch = !filters.role || log.role === filters.role;
      const dateMatch = !filters.date || format(new Date(log.changedAt), 'yyyy-MM-dd') === filters.date;
      return userMatch && roleMatch && dateMatch;
    });
  }, [logs, filters]);

  const uniqueRoles = useMemo(() => [...new Set(logs.map(log => log.role))], [logs]);

  const renderDetails = (details) => {
    try {
      const parsed = JSON.parse(details);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return <span className="text-slate-500">No details.</span>;
      }
      return (
        <ul className="space-y-1 text-xs">
          {parsed.map((change, index) => (
            <li key={index} className="flex items-start">
              <strong className="w-24 shrink-0">{change.field}:</strong>
              <span className="text-red-600 line-through mr-2">{change.oldValue || '""'}</span>
              <span>&rarr;</span>
              <span className="text-emerald-600 ml-2">{change.newValue || '""'}</span>
            </li>
          ))}
        </ul>
      );
    } catch {
      return <span className="text-slate-500">{details}</span>;
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2"><History className="text-indigo-600" /> User Activity Logs</h1>
        <p className="text-sm text-slate-500">Track all profile changes made by users.</p>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4 mb-4">
          <Filter size={16} className="text-slate-500" />
          <input 
            type="text" 
            placeholder="Filter by username..."
            value={filters.user}
            onChange={e => setFilters({...filters, user: e.target.value})}
            className="border p-2 rounded-lg text-sm"
          />
          <select value={filters.role} onChange={e => setFilters({...filters, role: e.target.value})} className="border p-2 rounded-lg text-sm">
            <option value="">All Roles</option>
            {uniqueRoles.map(role => <option key={role} value={role}>{role}</option>)}
          </select>
          <input 
            type="date" 
            value={filters.date}
            onChange={e => setFilters({...filters, date: e.target.value})}
            className="border p-2 rounded-lg text-sm"
          />
          <button onClick={() => setFilters({ user: '', role: '', date: '' })} className="text-indigo-600 text-sm font-semibold flex items-center gap-1"><X size={14}/> Clear</button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="p-3">User</th>
                <th className="p-3">Role</th>
                <th className="p-3">Action</th>
                <th className="p-3">Details</th>
                <th className="p-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan="5" className="p-8 text-center"><Loader2 className="animate-spin mx-auto" /></td></tr>
              ) : filteredLogs.length === 0 ? (
                <tr><td colSpan="5" className="p-8 text-center text-slate-500">No logs found.</td></tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id}>
                    <td className="p-3 font-semibold">{log.username}</td>
                    <td className="p-3"><span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded">{log.role}</span></td>
                    <td className="p-3">{log.action}</td>
                    <td className="p-3">{renderDetails(log.details)}</td>
                    <td className="p-3 text-xs text-slate-500">{format(new Date(log.changedAt), 'dd MMM yyyy, hh:mm a')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}