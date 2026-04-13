import React, { useEffect, useMemo, useState } from "react";
import {
  Shield,
  Users as UsersIcon,
  UserPlus,
  Edit3,
  Trash2,
  Save,
  X,
  Loader2,
  KeyRound,
  User,
  Briefcase,
  Mail,
  Phone,
} from "lucide-react";
import { printerService } from "../services/api";
import { ROLE_OPTIONS } from "../utils/rbac";

const INITIAL_FORM = {
  username: "",
  password: "",
  role: "User",
  fullName: "",
  email: "",
  phone: "",
};

const ROLE_STYLES = {
  Admin: "bg-indigo-100 text-indigo-700 border-indigo-200",
  Supervisor: "bg-sky-100 text-sky-700 border-sky-200",
  Accountant: "bg-emerald-100 text-emerald-700 border-emerald-200",
  User: "bg-amber-100 text-amber-700 border-amber-200",
  Operator: "bg-violet-100 text-violet-700 border-violet-200",
};

export default function Users({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(INITIAL_FORM);
  const [editingId, setEditingId] = useState(null);

  const loadUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await printerService.getUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed to load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const stats = useMemo(() => {
    return ROLE_OPTIONS.map((roleOption) => ({
      ...roleOption,
      count: users.filter((user) => user.role === roleOption.value).length,
    }));
  }, [users]);

  const resetForm = () => {
    setForm(INITIAL_FORM);
    setEditingId(null);
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      if (editingId) {
        await printerService.updateUser(editingId, form);
      } else {
        await printerService.createUser(form);
      }

      resetForm();
      await loadUsers();
    } catch (err) {
      setError(err.message || "Unable to save user.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (user) => {
    setEditingId(user.id);
    setForm({
      username: user.username || "",
      password: "",
      role: user.role || "User",
      fullName: user.fullName || "",
      email: user.email || "",
      phone: user.phone || "",
    });
    setError("");
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Delete user "${user.username}"?`)) return;

    setSubmitting(true);
    setError("");
    try {
      await printerService.deleteUser(user.id);
      if (editingId === user.id) {
        resetForm();
      }
      await loadUsers();
    } catch (err) {
      setError(err.message || "Unable to delete user.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-800 p-5 text-white">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-200 mb-2">
                <Shield size={12} />
                RBAC Control
              </div>
              <h1 className="text-2xl font-extrabold">User & Role Management</h1>
              <p className="text-sm text-indigo-100 mt-1">
                Create, update, and govern role-based access for the platform.
              </p>
            </div>
            <div className="bg-white/10 rounded-2xl px-4 py-3 backdrop-blur-sm border border-white/10">
              <p className="text-[11px] uppercase tracking-[0.14em] text-indigo-100">Signed in as</p>
              <p className="font-bold text-lg">{currentUser?.username || "Admin"}</p>
              <p className="text-xs text-indigo-100">{currentUser?.role || "Admin"}</p>
            </div>
          </div>
        </div>

        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 border-b border-slate-100">
          {stats.map((item) => (
            <div key={item.value} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="w-9 h-9 rounded-xl bg-white shadow-sm border border-slate-200 flex items-center justify-center">
                  <Briefcase size={16} className="text-slate-600" />
                </div>
                <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${ROLE_STYLES[item.value] || "bg-slate-100 text-slate-700 border-slate-200"}`}>
                  {item.label}
                </span>
              </div>
              <p className="text-2xl font-extrabold text-slate-800">{item.count}</p>
              <p className="text-xs text-slate-500">active accounts</p>
            </div>
          ))}
        </div>

        <div className="p-5 grid grid-cols-1 xl:grid-cols-[380px_minmax(0,1fr)] gap-5">
          <form onSubmit={handleSubmit} className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-slate-800">
                  {editingId ? "Edit User" : "Create User"}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  {editingId ? "Update credentials or change role access." : "Add a new account with a defined platform role."}
                </p>
              </div>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  <X size={12} />
                  Cancel
                </button>
              )}
            </div>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            )}

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Username</span>
              <div className="mt-1.5 relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                  placeholder="Enter username"
                  required
                />
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Full Name</span>
              <div className="mt-1.5 relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                  placeholder="Enter full name"
                />
              </div>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Email</span>
                <div className="mt-1.5 relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400" placeholder="user@example.com" />
                </div>
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Phone</span>
                <div className="mt-1.5 relative">
                  <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="tel" value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400" placeholder="Enter phone number" />
                </div>
              </label>
            </div>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Password {editingId ? "(Leave blank to keep current password)" : ""}
              </span>
              <div className="mt-1.5 relative">
                <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                  placeholder={editingId ? "Optional new password" : "Create password"}
                  required={!editingId}
                />
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Role</span>
              <select
                value={form.role}
                onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-60"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : editingId ? <Save size={16} /> : <UserPlus size={16} />}
              {editingId ? "Save Changes" : "Create User"}
            </button>
          </form>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-slate-800">Current Users</h2>
                <p className="text-xs text-slate-500 mt-1">Each role is restricted according to the new RBAC policy.</p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                <UsersIcon size={16} className="text-slate-500" />
                <span className="text-sm font-bold text-slate-700">{users.length}</span>
              </div>
            </div>

            {loading ? (
              <div className="p-10 flex items-center justify-center text-slate-500 gap-2">
                <Loader2 size={18} className="animate-spin" />
                Loading users...
              </div>
            ) : users.length === 0 ? (
              <div className="p-10 text-center text-slate-500">
                No users found.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {users.map((user) => {
                  const isSelf = Number(user.id) === Number(currentUser?.id);
                  return (
                    <div key={user.id} className="px-5 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 hover:bg-slate-50 transition-colors">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-slate-800">{user.username}</p>
                          {isSelf && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-900 text-white">
                              You
                            </span>
                          )}
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${ROLE_STYLES[user.role] || "bg-slate-100 text-slate-700 border-slate-200"}`}>
                            {user.role}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Created {user.createdAt ? new Date(user.createdAt).toLocaleString() : "recently"}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(user)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                        >
                          <Edit3 size={12} />
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={isSelf || submitting}
                          onClick={() => handleDelete(user)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Trash2 size={12} />
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
