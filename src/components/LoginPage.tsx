'use client';

import React, { useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import { Card, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Login gagal');
      }

      login(data.token, data.user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login gagal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F1F5F9] p-4 font-sans">
      <Card className="w-full max-w-4xl flex flex-col md:flex-row overflow-hidden rounded-none border-slate-200">
        <div className="md:w-1/2 bg-blue-900 relative hidden md:block min-h-[500px]">
          <img
            src="/banner.jpg"
            alt="Arsip Digital Perikanan"
            className="absolute inset-0 w-full h-full object-cover opacity-90"
          />
          <div className="absolute inset-0 bg-blue-900/20" />
          <div className="absolute bottom-8 left-8 right-8 text-white drop-shadow-md">
            <h2 className="text-2xl font-bold tracking-tight mb-2">Digitalisasi Arsip</h2>
            <p className="text-sm text-blue-50/90 font-medium">
              Sistem manajemen dokumen cerdas untuk efisiensi birokrasi perikanan.
            </p>
          </div>
        </div>
        <div className="md:w-1/2 p-8 md:p-12 flex flex-col justify-center bg-white">
          <div className="mb-10">
            <div className="w-12 h-12 bg-blue-600 flex items-center justify-center rounded-none mb-6 shadow-sm">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <CardTitle className="font-bold text-3xl tracking-tight text-slate-900 mb-2">
              ARSIP-<span className="font-light">DIGIKAN</span>
            </CardTitle>
            <p className="text-slate-500 text-[11px] font-bold uppercase tracking-widest leading-relaxed">
              Sistem Manajemen Arsip
              <br />
              Digital Perikanan
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-none text-sm text-center font-medium border border-red-100">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Username</label>
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="h-12"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-12"
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full h-12 mt-4 text-sm shadow-sm" disabled={loading}>
              {loading ? 'Memuat...' : 'MASUK KE SISTEM'}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
