import React, { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import Models from './components/Models';

const Login = lazy(() => import('./components/Login'));
const Signup = lazy(() => import('./components/Signup'));
const AdminLayout = lazy(() => import('./components/AdminLayout'));
const HelpChatWindow = lazy(() => import('./components/HelpChatWindow'));

const appLoader = (
  <div className="min-h-screen bg-slate-50 flex items-center justify-center">
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm px-6 py-4 text-sm font-semibold text-slate-600">
      Loading application...
    </div>
  </div>
);

export default function App() {
  return (
    <>
      <Suspense fallback={appLoader}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} /> 
          <Route path="/*" element={<AdminLayout />} />
        </Routes>
      </Suspense>

      <Suspense fallback={null}>
        <HelpChatWindow />
      </Suspense>
    </>
  );
}
