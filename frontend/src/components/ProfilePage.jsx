import React, { useState, useEffect } from 'react';
import { printerService } from '../services/api';
import { User, KeyRound, Save, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

// A simple toast notification component
const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const baseClasses = "fixed top-5 right-5 px-4 py-3 rounded-lg shadow-lg text-sm font-medium z-50 flex items-center gap-2";
  const typeClasses = {
    success: "bg-emerald-100 text-emerald-800 border border-emerald-200",
    error: "bg-red-100 text-red-800 border border-red-200",
  };
  const Icon = type === 'success' ? CheckCircle : AlertCircle;

  return (
    <div className={`${baseClasses} ${typeClasses[type]}`}>
      <Icon size={18} />
      {message}
    </div>
  );
};

export default function ProfilePage({ currentUser }) {
  const [profile, setProfile] = useState({ fullName: '', email: '', phone: '' });
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const data = await printerService.getProfile();
        setProfile({
          fullName: data.fullName || '',
          email: data.email || '',
          phone: data.phone || '',
        });
      } catch {
        setNotification({ type: 'error', message: 'Failed to load profile.' });
      } finally {
        setLoadingProfile(false);
      }
    }
    fetchProfile();
  }, []);

  const handleProfileChange = (e) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const handlePasswordChange = (e) => {
    setPasswordForm({ ...passwordForm, [e.target.name]: e.target.value });
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setNotification(null);
    try {
      await printerService.updateProfile(profile);
      setNotification({ type: 'success', message: 'Profile updated successfully.' });
    } catch (error) {
      setNotification({ type: 'error', message: error.response?.data?.message || 'Failed to update profile.' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setNotification({ type: 'error', message: 'New passwords do not match.' });
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setNotification({ type: 'error', message: 'Password must be at least 6 characters.' });
      return;
    }
    setSavingPassword(true);
    setNotification(null);
    try {
      await printerService.changePassword({
        oldPassword: passwordForm.oldPassword,
        newPassword: passwordForm.newPassword,
      });
      setNotification({ type: 'success', message: 'Password changed successfully.' });
      setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      setNotification({ type: 'error', message: error.response?.data?.message || 'Failed to change password.' });
    } finally {
      setSavingPassword(false);
    }
  };

  if (loadingProfile) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin text-indigo-600" size={32} /></div>;
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {notification && <Toast message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}
      
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-xl font-bold text-slate-800 mb-1 flex items-center gap-2"><User className="text-indigo-600" /> My Profile</h2>
        <p className="text-sm text-slate-500 mb-6">Update your personal information.</p>
        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500">Full Name</label>
              <input type="text" name="fullName" value={profile.fullName} onChange={handleProfileChange} className="w-full border p-2 rounded-lg mt-1" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500">Username</label>
              <input type="text" value={currentUser.username} disabled className="w-full border p-2 rounded-lg mt-1 bg-slate-100 cursor-not-allowed" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500">Email</label>
              <input type="email" name="email" value={profile.email} onChange={handleProfileChange} className="w-full border p-2 rounded-lg mt-1" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500">Phone</label>
              <input type="tel" name="phone" value={profile.phone} onChange={handleProfileChange} className="w-full border p-2 rounded-lg mt-1" />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={savingProfile} className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-semibold text-sm flex items-center gap-2 disabled:opacity-50">
              {savingProfile ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : <><Save size={16} /> Save Profile</>}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-xl font-bold text-slate-800 mb-1 flex items-center gap-2"><KeyRound className="text-indigo-600" /> Change Password</h2>
        <p className="text-sm text-slate-500 mb-6">Ensure your account is using a long, random password to stay secure.</p>
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500">Old Password</label>
            <input type="password" name="oldPassword" value={passwordForm.oldPassword} onChange={handlePasswordChange} className="w-full border p-2 rounded-lg mt-1" required />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500">New Password</label>
              <input type="password" name="newPassword" value={passwordForm.newPassword} onChange={handlePasswordChange} className="w-full border p-2 rounded-lg mt-1" required />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500">Confirm New Password</label>
              <input type="password" name="confirmPassword" value={passwordForm.confirmPassword} onChange={handlePasswordChange} className="w-full border p-2 rounded-lg mt-1" required />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={savingPassword} className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-semibold text-sm flex items-center gap-2 disabled:opacity-50">
              {savingPassword ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : <><Save size={16} /> Change Password</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
