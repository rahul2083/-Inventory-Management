import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Login from './components/Login';
import Signup from './components/Signup';
import AdminLayout from './components/AdminLayout';
import HelpChatWindow from './components/HelpChatWindow'; // 👈 Perfect import based on your screenshot

export default function App() {
  return (
    // <> ... </> (Fragment) use kiya hai taaki routing aur Chatbot dono bina kisi UI break ke kaam karein
    <>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Protected Route */}
        <Route path="/*" element={<AdminLayout />} />
      </Routes>

      {/* 👈 Chatbot yahan add kiya gaya hai (Bottom-Right Gmail style) */}
      <HelpChatWindow />
    </>
  );
}