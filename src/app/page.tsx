'use client';

import React, { useState } from 'react';
import { AuthProvider, useAuth } from '@/components/AuthContext';
import Login from '@/components/LoginPage';
import Dashboard from '@/components/DashboardPage';
import UploadDocument from '@/components/UploadDocumentPage';
import { FileText } from 'lucide-react';

type View = 'dashboard' | 'upload';

function AppContent() {
  const { user, isLoading } = useAuth();
  const [view, setView] = useState<View>('dashboard');

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center mesh-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-glow animate-pulse">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div className="text-slate-500 text-sm font-medium">Memuat...</div>
        </div>
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
