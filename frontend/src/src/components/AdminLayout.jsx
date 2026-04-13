import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Printer, Barcode, Truck, Loader2, RotateCcw, 
  AlertOctagon, FileText, Receipt, Package, Wrench, Users as UsersIcon, History, User
} from 'lucide-react'; 

import Dashboard from './Dashboard';
import Models from './Models';
import Serials from './Serials';
import Users from './Users';
import ProfilePage from './ProfilePage';
import UserActivity from './UserActivity';
import Dispatch from './Dispatch';
import NewDispatch from './NewDispatch';
import Returns from './Returns';
import Damaged from './Damaged';
import Reports from './Reports'; 
import Billing from "./Billing";
import OrderTracking from "./OrderTracking";
import Installations from "./Installations"; // ✅ Imported Installations Component
import { printerService } from '../services/api';

export default function AdminLayout() {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [models, setModels] = useState([]);
  const [serials, setSerials] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [returns, setReturns] = useState([]); 
  const [orders, setOrders] = useState([]);
  const [installations, setInstallations] = useState([]); // ✅ Added state for Installations
  const [installationStats, setInstallationStats] = useState(null); // ✅ Installation stats

  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  
  const [notification, setNotification] = useState(null);

  const navigate = useNavigate();

  // Extract Role
  const userRole = currentUser?.role || 'User';
  const isAdmin = userRole === 'Admin';
  const isSupervisor = userRole === 'Supervisor';
  const isAccountant = userRole === 'Accountant';
  const isUser = userRole === 'User' || userRole === 'Operator';

  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const refreshData = useCallback(async () => {
    try {
      // ✅ Added getInstallations and getInstallationStats
      const [m, s, d, r, o, inst, instStats] = await Promise.all([
        printerService.getModels(),
        printerService.getSerials(),
        printerService.getDispatches(true),
        printerService.getReturns(),
        printerService.getOrders(),
        printerService.getInstallations(),
        printerService.getInstallationStats()
      ]);
      setModels(m);
      setSerials(s);
      setDispatches(d);
      setReturns(r); 
      setOrders(o || []);
      setInstallations(inst || []); // ✅ Set Installations data
      setInstallationStats(instStats); // ✅ Set Installation stats
    } catch (err) {
      console.error("Error refreshing data:", err);
      showNotification("Failed to refresh data ❌", "error");
    }
  }, []);

  const handleUpdateDispatch = async (ids, updatedData) => {
    try {
      await printerService.updateDispatch(ids, updatedData);
      await refreshData();
      showNotification("Updated Successfully! ✅", "success");
    } catch (error) {
      console.error(error);
      showNotification("Failed to update ❌", "error");
    }
  };

  const handleDeleteDispatch = async (ids, reason) => {
    try {
      const result = await printerService.deleteDispatch(
        ids, 
        reason, 
        currentUser?.username || 'Unknown'
      );
      await refreshData();
      
      const successCount = result.results?.success?.length || ids.length;
      const failedCount = result.results?.failed?.length || 0;
      
      if (failedCount > 0) {
        showNotification(`Cancelled ${successCount} items. ${failedCount} failed.`, "warning");
      } else {
        showNotification(`✅ Cancelled ${successCount} dispatch(es).`, "success");
      }
    } catch (error) {
      console.error(error);
      showNotification("Failed to cancel ❌", "error");
    }
  };

  const handleRestoreDispatch = async (ids) => {
    try {
      const result = await printerService.restoreDispatch(ids);
      await refreshData();
      
      const successCount = result.results?.success?.length || ids.length;
      if (result.results?.failed?.length > 0) {
        showNotification(`Restored ${successCount}. Some failed.`, "warning");
      } else {
        showNotification(`✅ Restored ${successCount} dispatch(es)!`, "success");
      }
    } catch (error) {
      console.error(error);
      showNotification("Failed to restore ❌", "error");
    }
  };

  const handlePermanentDelete = async (ids) => {
    if (!isAdmin) {
      showNotification("🚫 Admin access required", "error");
      return;
    }
    if (!window.confirm("⚠️ PERMANENT DELETE: This cannot be undone. Continue?")) return;

    try {
      await printerService.permanentDeleteDispatch(ids);
      await refreshData();
      showNotification("🗑️ Permanently deleted", "success");
    } catch (error) {
      console.error(error);
      showNotification("Failed to delete ❌", "error");
    }
  };

  useEffect(() => {
    const userStr = localStorage.getItem('pt_user');
    if (!userStr) {
      navigate('/login');
      return;
    }
        // Wrapped to fix ESLint synchronous state update warning
        Promise.resolve().then(() => setCurrentUser(JSON.parse(userStr)));

    const init = async () => {
      await refreshData();
      setIsLoading(false);
    };
    init();
      }, [navigate, refreshData]);

  const handleLogout = () => {
    localStorage.removeItem('pt_user');
    navigate('/login');
  };

  // ✅ Calculate pending installations count for badge
  const pendingInstallationsCount = installations.filter(
    i => i.installationStatus === 'Pending' || i.installationStatus === 'Scheduled'
  ).length;

  const cancelledCount = dispatches.filter(d => d.isDeleted).length;

  // ✅ RBAC Array Setup
  const allNavItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['Admin', 'Supervisor', 'Accountant', 'User', 'Operator'] },
    { id: 'models', icon: Printer, label: 'Models', roles: ['Admin', 'Supervisor', 'User', 'Operator'] },
    { id: 'serials', icon: Barcode, label: 'Serials', roles: ['Admin', 'Supervisor', 'User', 'Operator'] },
    { id: 'orderTracking', icon: Package, label: 'Order Processing', roles: ['Admin', 'Supervisor', 'User', 'Operator'] },
    { id: 'billing', icon: Receipt, label: 'Billing', roles: ['Admin', 'Accountant'] },
    { id: 'dispatch', icon: Truck, label: 'Dispatch', roles: ['Admin', 'Supervisor', 'User', 'Operator'] },
    { id: 'installations', icon: Wrench, label: 'Installations', badge: pendingInstallationsCount > 0 ? pendingInstallationsCount : null, badgeColor: 'orange', roles: ['Admin', 'Supervisor', 'User', 'Operator'] },
    { id: 'returns', icon: RotateCcw, label: 'Returns', roles: ['Admin', 'Supervisor', 'User', 'Operator'] },
    { id: 'damaged', icon: AlertOctagon, label: 'Damaged', roles: ['Admin', 'Supervisor', 'User', 'Operator'] },
    { id: 'users', icon: UsersIcon, label: 'User Management', roles: ['Admin'] },
    { id: 'activity', icon: History, label: 'User Activity', roles: ['Admin'] },
    { id: 'reports', icon: FileText, label: 'Reports', roles: ['Admin', 'Supervisor', 'Accountant'] },
    { id: 'profile', icon: User, label: 'Profile', roles: ['Admin', 'Supervisor', 'Accountant', 'User', 'Operator'], hidden: true }
  ];

  const navItems = allNavItems.filter(item => item.roles.includes(userRole));

  if (!currentUser) return null;

  return (
    <div className="flex h-screen bg-slate-50 relative">
      
      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-5 right-5 px-4 py-3 rounded-lg shadow-lg text-sm font-medium z-50 
          transition-all transform animate-in slide-in-from-right duration-300
          ${notification.type === 'success' ? 'bg-green-100 text-green-800 border-green-200' : 
            notification.type === 'warning' ? 'bg-amber-100 text-amber-800 border-amber-200' : 
            'bg-red-100 text-red-800 border-red-200'}`}
        >
          {notification.message}
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-60 bg-white border-r flex flex-col hidden md:flex print:hidden">

        <div className="p-4 flex flex-col items-center justify-center border-b border-slate-100">
          {/* Logo Image */}
          <img 
            src="/aplus.png"  // 👈 Yahan apni image ka naam likhein
            alt="Company Logo"
            className="h-12 w-auto object-contain mb-[-35px]" // Size adjust karne ke liye h-16 ko change kar sakte hain
          />
        </div>
        <div className="p-4 font-bold text-indigo-600 text-lg flex items-center gap-2">
         Inventory Management 
        </div>
        <div className="px-4 py-2 text-xs text-slate-400 uppercase">Menu</div>
        <nav className="flex-1 px-2 space-y-1 overflow-y-auto">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            
            // ✅ Dynamic styling for different tabs
            const isDamagedTab = item.id === 'damaged';
            const isInstallationTab = item.id === 'installations';
            
            // Show badge for dispatch (cancelled) or installations (pending)
            const showDispatchBadge = item.id === 'dispatch' && cancelledCount > 0;
            const showInstallationBadge = item.badge && item.badge > 0;

            return (
              !item.hidden && <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative ${
                  isActive
                    ? isDamagedTab 
                      ? 'bg-red-50 text-red-600' 
                      : isInstallationTab
                        ? 'bg-orange-50 text-orange-600'
                        : 'bg-indigo-50 text-indigo-600'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon size={18} /> 
                {item.label}
                
                {/* Dispatch Cancelled Badge */}
               {/*showDispatchBadge && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                    {cancelledCount}
                 </span>
                )*/}
                
                {/* ✅ Installation Pending Badge */}
                {/*showInstallationBadge && (
                  <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${
                    item.badgeColor === 'orange' ? 'bg-orange-500' : 'bg-red-500'
                  }`}>
                    {item.badge}
                  </span>
                )*/}
              </button>
            );
          })}
        </nav>
        
        {/* User Section */}
        <div className="p-4 border-t border-slate-100">
          <div className='flex items-center gap-3 mb-3'>
            <div className='w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold'>
              {currentUser.username[0].toUpperCase()}
            </div>
            <div className='text-sm'>
              <p className='font-semibold text-slate-700'>{currentUser.username}</p>
              <p className={`text-xs ${isAdmin ? 'text-indigo-500 font-medium' : 'text-slate-400'}`}>
                {currentUser.role || 'User'}
                {isAdmin && ' ⭐'}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-1 mt-2">
            <button onClick={() => setActiveTab('profile')} className="w-full text-center text-indigo-600 text-xs hover:bg-indigo-50 py-2 rounded-lg transition font-semibold">My Profile</button>
          </div>
          <button onClick={handleLogout} className="w-full text-center text-red-600 text-xs hover:bg-red-50 py-2 rounded transition">
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-white border-b z-40 px-4 py-3 flex justify-between items-center print:hidden">
        <span className="font-bold text-indigo-600">PrintTrack</span>
        <div className="flex gap-1">
          {navItems.slice(0, 5).map(item => {
            const Icon = item.icon;
            const isInstallationTab = item.id === 'installations';
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`p-2 rounded relative ${
                  activeTab === item.id 
                    ? isInstallationTab 
                      ? 'bg-orange-100 text-orange-600' 
                      : 'bg-indigo-100 text-indigo-600' 
                    : 'text-slate-500'
                }`}
              >
                <Icon size={18} />
                {/* Mobile badge for installations */}
                {item.id === 'installations' && pendingInstallationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {pendingInstallationsCount > 9 ? '9+' : pendingInstallationsCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t z-40 px-2 py-2 flex justify-around items-center print:hidden">
        {navItems.slice(5, 9).map(item => {
          const Icon = item.icon;
          const isInstallationTab = item.id === 'installations';
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`p-2 rounded flex flex-col items-center relative ${
                activeTab === item.id 
                  ? isInstallationTab 
                    ? 'text-orange-600' 
                    : 'text-indigo-600' 
                  : 'text-slate-500'
              }`}
            >
              <Icon size={18} />
              <span className="text-[10px] mt-0.5">{item.label}</span>
              {/* Badge */}
              {item.badge && item.badge > 0 && (
                <span className="absolute -top-1 right-0 bg-orange-500 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-6 overflow-auto md:mt-0 mt-14 mb-16 md:mb-0 print:p-0 print:m-0 print:overflow-visible">
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="animate-spin text-indigo-600" size={32} />
          </div>
        ) : (
          <div className="max-w-6xl mx-auto print:max-w-none">
            
            {activeTab === 'dashboard' && (
              <Dashboard 
                models={models} 
                serials={serials} 
                dispatches={dispatches} 
                returns={returns}
                installations={installations} // ✅ Pass installations to Dashboard
                onNavigate={setActiveTab} 
                isAdmin={isAdmin}
                isAccountant={isAccountant}
                isSupervisor={isSupervisor}
              />
            )}
            
            {activeTab === 'models' && (
              <Models models={models} serials={serials} onRefresh={refreshData} isAdmin={isAdmin} isUser={isUser} />
            )}
            
            {activeTab === 'serials' && (
              <Serials models={models} serials={serials} onRefresh={refreshData} isAdmin={isAdmin} isUser={isUser} />
            )}
            
            {activeTab === 'dispatch' && (
              <Dispatch 
                models={models} 
                serials={serials} 
                companies={[]} 
                dispatches={dispatches} 
                currentUser={currentUser}
                onNew={() => setActiveTab('newDispatch')} 
                onUpdate={handleUpdateDispatch} 
                onDelete={handleDeleteDispatch}
                onRestore={handleRestoreDispatch}
                onPermanentDelete={handlePermanentDelete}
                isAdmin={isAdmin} 
                    isSupervisor={isSupervisor}
              />
            )}
            
            {activeTab === 'newDispatch' && (
              <NewDispatch 
                models={models} 
                serials={serials} 
                companies={[]} 
                currentUser={currentUser} 
                onRefresh={refreshData} 
                onBack={() => setActiveTab('dispatch')} 
              />
            )}
            
            {activeTab === 'billing' && (
              <Billing 
                models={models}
                serials={serials}
                dispatches={dispatches}
                onUpdate={handleUpdateDispatch} 
                isAdmin={isAdmin}
              />
            )}

            {activeTab === 'orderTracking' && (
              <OrderTracking 
                orders={orders}
                currentUser={currentUser}
                onRefresh={refreshData}
                isAdmin={isAdmin}
                isSupervisor={isSupervisor}
              />
            )}

            {/* ✅ Render the Installations Component */}
            {activeTab === 'installations' && (
              <Installations 
                installations={installations}
                stats={installationStats}
                onRefresh={refreshData}
                isAdmin={isAdmin}
                isSupervisor={isSupervisor}
              />
            )}

            {activeTab === 'returns' && (
              <Returns onRefresh={refreshData} isAdmin={isAdmin} />
            )}
            
            {activeTab === 'damaged' && (
              <Damaged returns={returns} isAdmin={isAdmin} isUser={isUser} onRefresh={refreshData} />
            )}
            
            {activeTab === 'reports' && (isAdmin || isSupervisor || isAccountant) && <Reports isAdmin={isAdmin} isAccountant={isAccountant} isSupervisor={isSupervisor} />}
            
            {activeTab === 'users' && isAdmin && <Users currentUser={currentUser} />}
            {activeTab === 'profile' && <ProfilePage currentUser={currentUser} />}
            {activeTab === 'activity' && isAdmin && <UserActivity />}

          </div>
        )}
      </main>
    </div>
  );
}