import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { ProtectedRoute } from './components/auth/ProtectedRoute.js';
import { Toaster } from 'sonner';

export const App: React.FC = () => {
  return (
    <>
      <Toaster
        position="top-right"
        theme="light"
        toastOptions={{
          style: {
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            color: '#111827',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.04)',
            borderRadius: '8px',
          },
        }}
      />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
};
