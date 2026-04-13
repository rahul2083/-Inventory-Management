import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { printerService } from "../services/api";
import { UserPlus, User, Lock, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { getStoredUser } from "../utils/auth";
import { ROLE_OPTIONS } from "../utils/rbac";

export default function Signup() {
  const [formData, setFormData] = useState({ username: "", password: "", role: "User" });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const navigate = useNavigate();
  const currentUser = useMemo(() => getStoredUser(), []);

  useEffect(() => {
    let mounted = true;

    const loadBootstrapStatus = async () => {
      try {
        const result = await printerService.getBootstrapStatus();
        if (!mounted) return;

        const needsSetup = Boolean(result?.setupRequired);
        setSetupRequired(needsSetup);
        if (needsSetup) {
          setFormData((prev) => ({ ...prev, role: "Admin" }));
        }
      } catch {
        if (mounted) {
          setSetupRequired(false);
        }
      }
    };

    loadBootstrapStatus();

    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await printerService.signup(formData);
      setTimeout(() => {
        navigate("/login");
      }, 1000);
    } catch (err) {
      setError(err.response?.data?.message || "Username already taken or invalid.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex justify-center items-center p-4 relative overflow-hidden animate-soft-fade">
      
      {/* Decorative Background Blobs */}
      <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-emerald-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-float-soft"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-teal-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-float-soft stagger-3"></div>

      <div className="bg-white/80 backdrop-blur-lg p-8 rounded-2xl shadow-xl w-full max-w-sm border border-white relative z-10 animate-page-enter">
        
        {/* ✅ Logo & Company Section */}
        <div className="flex flex-col items-center mb-8">
          
          {/* ✅ Direct Company Logo — No box, no background */}
          <div className="mb-[-16] transform transition-transform hover:scale-110 duration-300 animate-float-soft">
            {/* 
              ✅ REPLACE src="/logo.png" with your actual logo file path
              Same logo as Login page
            */}
            <img 
              src="/aplus.png" 
              alt="Company Logo" 
              className="w-50 h-50 object-contain drop-shadow-lg"
              onError={(e) => {
                // Fallback: Agar logo load na ho toh icon dikhega
                e.target.style.display = 'none';
                e.target.nextElementSibling.style.display = 'flex';
              }}
            />
            {/* Fallback icon — sirf tab dikhega jab logo load na ho */}
            <div 
              className="hidden p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-lg items-center justify-center"
            >
              <UserPlus className="text-white" size={32} />
            </div>
          </div>

        

          {/* ✅ Company Tagline */}
          <p className="text-[11px] text-slate-400 font-medium mt-1 tracking-wide">
            {/* ✅ CHANGE: Apni tagline likho */}
            Inventory & Dispatch Management
          </p>

         

          {/* Welcome text */}
          <h2 className="text-2xl font-bold text-slate-800 mt-4">Create Account</h2>
          <p className="text-slate-500 text-sm mt-1">Join us to start tracking inventory</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg flex items-center gap-2 animate-pulse">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* Username Input */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide ml-1">Username</label>
            <div className="relative group">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
              <input
                type="text"
                className="w-full border border-slate-200 bg-slate-50/50 p-2.5 pl-10 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all duration-200 text-sm text-slate-700"
                placeholder="Choose a username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide ml-1">Password</label>
            <div className="relative group">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
              <input
                type="password"
                className="w-full border border-slate-200 bg-slate-50/50 p-2.5 pl-10 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all duration-200 text-sm text-slate-700"
                placeholder="Create a password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide ml-1">Role</label>
            <select
              className="w-full border border-slate-200 bg-slate-50/50 p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all duration-200 text-sm text-slate-700"
              value={setupRequired ? "Admin" : formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              disabled={setupRequired}
            >
              {(setupRequired ? ROLE_OPTIONS.filter((option) => option.value === "Admin") : ROLE_OPTIONS).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 ml-1">
              {setupRequired
                ? "The first account is created as Administrator."
                : currentUser?.role === "Admin"
                  ? "Admin can assign roles during user creation."
                  : "Only Admin can create users once setup is complete."}
            </p>
          </div>

          {/* Submit Button */}
          <button
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3 rounded-xl font-medium shadow-lg shadow-emerald-200 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                Sign Up <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link to="/login" className="text-emerald-600 font-bold hover:text-emerald-700 transition-colors">
            Sign In
          </Link>
        </div>

        {/* ✅ Bottom Branding */}
        <div className="mt-6 pt-4 border-t border-slate-100 text-center">
          <div className="flex items-center justify-center gap-2">
            <img 
              src="/logo.png" 
              alt="" 
              className="w-4 h-4 object-contain opacity-50"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            {/* ✅ CHANGE: Apni company ka naam likho */}
            <span className="text-[10px] text-slate-400 font-bold tracking-wide">
              © {new Date().getFullYear()} Your Company Name
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
