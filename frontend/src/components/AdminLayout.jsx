import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { useNavigate, Routes, Route, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Printer,
  Barcode,
  Truck,
  Loader2,
  RotateCcw,
  AlertOctagon,
  FileText,
  Receipt,
  Package,
  Wrench,
  Users as UsersIcon,
  History,
  User
} from 'lucide-react';
import { printerService } from '../services/api';

const Dashboard = lazy(() => import('./Dashboard'));
const Models = lazy(() => import('./Models'));
const Serials = lazy(() => import('./Serials'));
const Users = lazy(() => import('./Users'));
const ProfilePage = lazy(() => import('./ProfilePage'));
const UserActivity = lazy(() => import('./UserActivity'));
const Dispatch = lazy(() => import('./Dispatch'));
const NewDispatch = lazy(() => import('./NewDispatch'));
const Returns = lazy(() => import('./Returns'));
const Damaged = lazy(() => import('./Damaged'));
const Reports = lazy(() => import('./Reports'));
const Billing = lazy(() => import('./Billing'));
const OrderTracking = lazy(() => import('./OrderTracking'));
const Installations = lazy(() => import('./Installations'));

const tabContentFallback = (
  <div className="flex justify-center items-center min-h-[320px]">
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex items-center gap-3">
      <Loader2 className="animate-spin text-indigo-600" size={22} />
      <span className="text-sm font-semibold text-slate-600">Loading section...</span>
    </div>
  </div>
);

const getReturnsArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  if (payload && Array.isArray(payload.returns)) return payload.returns;
  if (payload && Array.isArray(payload.results)) return payload.results;
  return [];
};

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const activeTab = location.pathname.split('/')[1] || 'dashboard';

  const [models, setModels] = useState([]);
  const [serials, setSerials] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [returns, setReturns] = useState([]);
  const [orders, setOrders] = useState([]);
  const [orderTrackingFocusId, setOrderTrackingFocusId] = useState(null);
  const [installations, setInstallations] = useState([]);
  const [installationStats, setInstallationStats] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [notification, setNotification] = useState(null);
  const [dataStatus, setDataStatus] = useState({
    models: false,
    serials: false,
    dispatches: false,
    returns: false,
    orders: false,
    installations: false,
    installationStats: false
  });

  const userRole = currentUser?.role || 'User';
  const isAdmin = userRole === 'Admin';
  const isSupervisor = userRole === 'Supervisor';
  const isAccountant = userRole === 'Accountant';
  const isUser = userRole === 'User' || userRole === 'Operator';

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const markDataLoaded = useCallback((nextStatus) => {
    setDataStatus((prev) => ({ ...prev, ...nextStatus }));
  }, []);

  const loadCoreData = useCallback(async () => {
    const results = await Promise.allSettled([
      printerService.getModels(),
      printerService.getSerials(),
      printerService.getDispatches(true),
      printerService.getReturns()
    ]);

    let hasFailure = false;
    const loadedKeys = {};

    if (results[0].status === 'fulfilled') {
      setModels(Array.isArray(results[0].value) ? results[0].value : []);
      loadedKeys.models = true;
    } else {
      hasFailure = true;
      console.error('Failed to load models:', results[0].reason);
    }

    if (results[1].status === 'fulfilled') {
      setSerials(Array.isArray(results[1].value) ? results[1].value : []);
      loadedKeys.serials = true;
    } else {
      hasFailure = true;
      console.error('Failed to load serials:', results[1].reason);
    }

    if (results[2].status === 'fulfilled') {
      setDispatches(Array.isArray(results[2].value) ? results[2].value : []);
      loadedKeys.dispatches = true;
    } else {
      hasFailure = true;
      console.error('Failed to load dispatches:', results[2].reason);
    }

    if (results[3].status === 'fulfilled') {
      setReturns(getReturnsArray(results[3].value));
      loadedKeys.returns = true;
    } else {
      hasFailure = true;
      console.error('Failed to load returns:', results[3].reason);
    }

    markDataLoaded(loadedKeys);
    return !hasFailure;
  }, [markDataLoaded]);

  const loadOrdersData = useCallback(async () => {
    try {
      const data = await printerService.getOrders();
      setOrders(Array.isArray(data) ? data : []);
      markDataLoaded({ orders: true });
      return true;
    } catch (error) {
      console.error('Failed to load orders:', error);
      return false;
    }
  }, [markDataLoaded]);

  const loadInstallationData = useCallback(async () => {
    const results = await Promise.allSettled([
      printerService.getInstallations(),
      printerService.getInstallationStats()
    ]);

    let hasFailure = false;
    const loadedKeys = {};

    if (results[0].status === 'fulfilled') {
      setInstallations(Array.isArray(results[0].value) ? results[0].value : []);
      loadedKeys.installations = true;
    } else {
      hasFailure = true;
      console.error('Failed to load installations:', results[0].reason);
    }

    if (results[1].status === 'fulfilled') {
      setInstallationStats(results[1].value || null);
      loadedKeys.installationStats = true;
    } else {
      hasFailure = true;
      console.error('Failed to load installation stats:', results[1].reason);
    }

    markDataLoaded(loadedKeys);
    return !hasFailure;
  }, [markDataLoaded]);

  const refreshData = useCallback(
    async ({
      includeOrders = dataStatus.orders || activeTab === 'orderTracking',
      includeInstallations =
        dataStatus.installations ||
        dataStatus.installationStats ||
        activeTab === 'installations'
    } = {}) => {
      const tasks = [loadCoreData()];

      if (includeOrders) {
        tasks.push(loadOrdersData());
      }

      if (includeInstallations) {
        tasks.push(loadInstallationData());
      }

      await Promise.all(tasks);
    },
    [
      activeTab,
      dataStatus.installationStats,
      dataStatus.installations,
      dataStatus.orders,
      loadCoreData,
      loadInstallationData,
      loadOrdersData
    ]
  );

  const handleUpdateDispatch = async (ids, updatedData) => {
    try {
      await printerService.updateDispatch(ids, updatedData);
      await refreshData();
      showNotification('Updated Successfully! ✅', 'success');
    } catch (error) {
      console.error(error);
      showNotification('Failed to update ❌', 'error');
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
        showNotification(`Cancelled ${successCount} items. ${failedCount} failed.`, 'warning');
      } else {
        showNotification(`✅ Cancelled ${successCount} dispatch(es).`, 'success');
      }
    } catch (error) {
      console.error(error);
      showNotification('Failed to cancel ❌', 'error');
    }
  };

  const handleRestoreDispatch = async (ids) => {
    try {
      const result = await printerService.restoreDispatch(ids);
      await refreshData();

      const successCount = result.results?.success?.length || ids.length;
      if (result.results?.failed?.length > 0) {
        showNotification(`Restored ${successCount}. Some failed.`, 'warning');
      } else {
        showNotification(`✅ Restored ${successCount} dispatch(es)!`, 'success');
      }
    } catch (error) {
      console.error(error);
      showNotification('Failed to restore ❌', 'error');
    }
  };

  const handlePermanentDelete = async (ids) => {
    if (!isAdmin) {
      showNotification('🚫 Admin access required', 'error');
      return;
    }

    if (!window.confirm('⚠️ PERMANENT DELETE: This cannot be undone. Continue?')) return;

    try {
      await printerService.permanentDeleteDispatch(ids);
      await refreshData();
      showNotification('🗑️ Permanently deleted', 'success');
    } catch (error) {
      console.error(error);
      showNotification('Failed to delete ❌', 'error');
    }
  };

  useEffect(() => {
    const userStr = localStorage.getItem('pt_user');
    if (!userStr) {
      navigate('/login');
      return;
    }

    try {
      setCurrentUser(JSON.parse(userStr));
    } catch (error) {
      console.error('Failed to parse current user:', error);
      localStorage.removeItem('pt_user');
      navigate('/login');
      return;
    }

    const init = async () => {
      const coreLoaded = await loadCoreData();
      if (!coreLoaded) {
        showNotification('Some dashboard data could not be loaded. You can still keep working.', 'warning');
      }
      setIsLoading(false);
    };

    init();
  }, [loadCoreData, navigate]);

  useEffect(() => {
    if (activeTab === 'orderTracking' && !dataStatus.orders) {
      loadOrdersData();
    }

    if (
      activeTab === 'installations' &&
      (!dataStatus.installations || !dataStatus.installationStats)
    ) {
      loadInstallationData();
    }
  }, [
    activeTab,
    dataStatus.installationStats,
    dataStatus.installations,
    dataStatus.orders,
    loadInstallationData,
    loadOrdersData
  ]);

  const handleLogout = () => {
    localStorage.removeItem('pt_user');
    navigate('/login');
  };

  const handleOpenOrderDetails = useCallback((orderId) => {
    const safeOrderId = Number(orderId);
    if (!Number.isFinite(safeOrderId)) return;
    setOrderTrackingFocusId(safeOrderId);
      navigate('/orderTracking');
    }, [navigate]);

  const pendingInstallationsCount = installations.filter(
    (item) => item.installationStatus === 'Pending' || item.installationStatus === 'Scheduled'
  ).length;

  const allNavItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['Admin', 'Supervisor', 'Accountant', 'User', 'Operator'] },
    { id: 'models', icon: Printer, label: 'Models', roles: ['Admin', 'Supervisor', 'User', 'Operator'] },
    { id: 'serials', icon: Barcode, label: 'Serials', roles: ['Admin', 'Supervisor', 'User', 'Operator'] },
    { id: 'orderTracking', icon: Package, label: 'Order Processing', roles: ['Admin', 'Supervisor', 'User', 'Operator'] },
    { id: 'billing', icon: Receipt, label: 'Billing', roles: ['Admin', 'Accountant'] },
    { id: 'dispatch', icon: Truck, label: 'Dispatch', roles: ['Admin', 'Supervisor', 'User', 'Operator'] },
    {
      id: 'installations',
      icon: Wrench,
      label: 'Installations',
      badge: pendingInstallationsCount > 0 ? pendingInstallationsCount : null,
      badgeColor: 'orange',
      roles: ['Admin', 'Supervisor', 'User', 'Operator']
    },
    { id: 'returns', icon: RotateCcw, label: 'Returns', roles: ['Admin', 'Supervisor', 'User', 'Operator'] },
    { id: 'damaged', icon: AlertOctagon, label: 'Damaged', roles: ['Admin', 'Supervisor', 'User', 'Operator'] },
    { id: 'users', icon: UsersIcon, label: 'User Management', roles: ['Admin'] },
    { id: 'activity', icon: History, label: 'User Activity', roles: ['Admin'] },
    { id: 'reports', icon: FileText, label: 'Reports', roles: ['Admin', 'Supervisor', 'Accountant'] },
    {
      id: 'profile',
      icon: User,
      label: 'Profile',
      roles: ['Admin', 'Supervisor', 'Accountant', 'User', 'Operator'],
      hidden: true
    }
  ];

  const navItems = allNavItems.filter((item) => item.roles.includes(userRole));
  const catalogLoaded = dataStatus.models && dataStatus.serials;
  const returnsLoaded = dataStatus.returns;
  const installationsLoaded = dataStatus.installations && dataStatus.installationStats;

  if (!currentUser) return null;

  return (
    <div className="flex h-screen bg-slate-50 relative">
      {notification && (
        <div
          className={`fixed top-5 right-5 px-4 py-3 rounded-lg shadow-lg text-sm font-medium z-50 transition-all transform animate-in slide-in-from-right duration-300 ${
            notification.type === 'success'
              ? 'bg-green-100 text-green-800 border-green-200'
              : notification.type === 'warning'
                ? 'bg-amber-100 text-amber-800 border-amber-200'
                : 'bg-red-100 text-red-800 border-red-200'
          }`}
        >
          {notification.message}
        </div>
      )}

      <aside className="w-60 bg-white border-r flex flex-col hidden md:flex print:hidden">
        <div className="p-4 flex flex-col items-center justify-center border-b border-slate-100">
          <img
            src="/aplus.png"
            alt="Company Logo"
            className="h-12 w-auto object-contain mb-[-35px]"
          />
        </div>
        <div className="p-4 font-bold text-indigo-600 text-lg flex items-center gap-2">
          Inventory Management
        </div>
        <div className="px-4 py-2 text-xs text-slate-400 uppercase">Menu</div>
        <nav className="flex-1 px-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const isDamagedTab = item.id === 'damaged';
            const isInstallationTab = item.id === 'installations';

            return (
              !item.hidden && (
                <button
                  key={item.id}
                  onClick={() => navigate(`/${item.id === 'dashboard' ? '' : item.id}`)}
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
                </button>
              )
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
              {currentUser.username[0].toUpperCase()}
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-700">{currentUser.username}</p>
              <p className={`text-xs ${isAdmin ? 'text-indigo-500 font-medium' : 'text-slate-400'}`}>
                {currentUser.role || 'User'}
                {isAdmin && ' ⭐'}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-1 mt-2">
            <button
              onClick={() => navigate('/profile')}
              className="w-full text-center text-indigo-600 text-xs hover:bg-indigo-50 py-2 rounded-lg transition font-semibold"
            >
              My Profile
            </button>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-center text-red-600 text-xs hover:bg-red-50 py-2 rounded transition"
          >
            Sign Out
          </button>
        </div>
      </aside>

      <div className="md:hidden fixed top-0 left-0 right-0 bg-white border-b z-40 px-4 py-3 flex justify-between items-center print:hidden">
        <span className="font-bold text-indigo-600">PrintTrack</span>
        <div className="flex gap-1">
          {navItems.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const isInstallationTab = item.id === 'installations';

            return (
              <button
                key={item.id}
                onClick={() => navigate(`/${item.id === 'dashboard' ? '' : item.id}`)}
                className={`p-2 rounded relative ${
                  activeTab === item.id
                    ? isInstallationTab
                      ? 'bg-orange-100 text-orange-600'
                      : 'bg-indigo-100 text-indigo-600'
                    : 'text-slate-500'
                }`}
              >
                <Icon size={18} />
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

      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t z-40 px-2 py-2 flex justify-around items-center print:hidden">
        {navItems.slice(5, 9).map((item) => {
          const Icon = item.icon;
          const isInstallationTab = item.id === 'installations';

          return (
            <button
              key={item.id}
              onClick={() => navigate(`/${item.id === 'dashboard' ? '' : item.id}`)}
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
              {item.badge && item.badge > 0 && (
                <span className="absolute -top-1 right-0 bg-orange-500 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <main className="flex-1 p-4 md:p-6 overflow-auto md:mt-0 mt-14 mb-16 md:mb-0 print:p-0 print:m-0 print:overflow-visible">
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="animate-spin text-indigo-600" size={32} />
          </div>
        ) : (
          <div className="max-w-6xl mx-auto print:max-w-none">
            <Suspense fallback={tabContentFallback}>
              <Routes>
                <Route path="/" element={<Dashboard models={models} serials={serials} dispatches={dispatches} returns={returns} onNavigate={(tab) => navigate(`/${tab === 'dashboard' ? '' : tab}`)} isAdmin={isAdmin} isAccountant={isAccountant} isSupervisor={isSupervisor} />} />
                <Route path="/models" element={<Models models={models} serials={serials} onRefresh={refreshData} isAdmin={isAdmin} isUser={isUser} />} />
                <Route path="/serials" element={<Serials models={models} serials={serials} onRefresh={refreshData} isAdmin={isAdmin} isUser={isUser} />} />
                <Route path="/dispatch" element={<Dispatch models={models} serials={serials} companies={[]} dispatches={dispatches} currentUser={currentUser} onNew={() => navigate('/newDispatch')} onUpdate={handleUpdateDispatch} onDelete={handleDeleteDispatch} onRestore={handleRestoreDispatch} onPermanentDelete={handlePermanentDelete} isAdmin={isAdmin} isSupervisor={isSupervisor} isAccountant={isAccountant} />} />
                <Route path="/newDispatch" element={<NewDispatch models={models} serials={serials} companies={[]} currentUser={currentUser} onRefresh={refreshData} onBack={() => navigate('/dispatch')} />} />
                <Route path="/billing" element={<Billing models={models} serials={serials} dispatches={dispatches} onUpdate={handleUpdateDispatch} />} />
                <Route path="/orderTracking" element={<OrderTracking orders={orders} models={models} serials={serials} returns={returns} currentUser={currentUser} onRefresh={refreshData} isAdmin={isAdmin} isSupervisor={isSupervisor} focusOrderId={orderTrackingFocusId} onFocusHandled={() => setOrderTrackingFocusId(null)} catalogLoaded={catalogLoaded} returnsLoaded={returnsLoaded} />} />
                <Route path="/installations" element={<Installations installations={installations} stats={installationStats} isLoaded={installationsLoaded} onRefresh={refreshData} isSupervisor={isSupervisor} />} />
                <Route path="/returns" element={<Returns returns={returns} isLoaded={returnsLoaded} onRefresh={refreshData} isAdmin={isAdmin} isSupervisor={isSupervisor} currentUser={currentUser} onOpenOrderDetails={handleOpenOrderDetails} />} />
                <Route path="/damaged" element={<Damaged returns={returns} isAdmin={isAdmin} isUser={isUser} onRefresh={refreshData} />} />
                <Route path="/reports" element={(isAdmin || isSupervisor || isAccountant) ? <Reports isAdmin={isAdmin} isAccountant={isAccountant} returns={returns} /> : <div />} />
                <Route path="/users" element={isAdmin ? <Users currentUser={currentUser} /> : <div />} />
                <Route path="/profile" element={<ProfilePage currentUser={currentUser} />} />
                <Route path="/activity" element={isAdmin ? <UserActivity /> : <div />} />
              </Routes>
            </Suspense>
          </div>
        )}
      </main>
    </div>
  );
}
