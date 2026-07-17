'use client';

import React, { useState } from 'react';
import { AuthProvider, useAuth } from '@/components/AuthContext';
import Login from '@/components/LoginPage';
import Dashboard from '@/components/DashboardPage';
import UploadDocument from '@/components/UploadDocumentPage';

type View = 'dashboard' | 'upload';

function AppContent() {
  const { user, isLoading } = useAuth();
  const [view, setView] = useState<View>('dashboard');

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F1F5F9]">
        <div className="text-slate-500 text-sm font-medium">Memuat...</div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (view === 'upload') {
    return (
      <UploadDocument
        onBack={() => setView('dashboard')}
        onSuccess={() => setView('dashboard')}
      />
    );
  }

  return <Dashboard onAddDocument={() => setView('upload')} />;
}

export default function Home() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
