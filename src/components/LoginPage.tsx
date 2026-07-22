'use client';

import React, { useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FileText, Loader2, Eye, EyeOff, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
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
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 font-sans relative overflow-hidden">
      {/* Animated mesh background */}
      <div className="absolute inset-0 mesh-bg" aria-hidden="true" />
      <div
        className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full opacity-40 blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.35) 0%, transparent 70%)' }}
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-32 -left-32 w-[420px] h-[420px] rounded-full opacity-30 blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.3) 0%, transparent 70%)' }}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-5xl grid md:grid-cols-2 rounded-3xl overflow-hidden shadow-soft-lg bg-white/80 backdrop-blur-xl border border-white/60 animate-scale-in">
        {/* Left brand panel */}
        <div className="relative hidden md:block overflow-hidden">
          <img
            src="/banner.jpg"
            alt="Arsip Digital Perikanan"
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Gradient overlay */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(135deg, rgba(30, 41, 59, 0.92) 0%, rgba(67, 56, 202, 0.78) 50%, rgba(76, 29, 149, 0.85) 100%)',
            }}
          />
          {/* Decorative blobs */}
          <div className="absolute top-12 left-12 w-32 h-32 rounded-full bg-indigo-400/20 blur-2xl" aria-hidden="true" />
          <div className="absolute bottom-20 right-12 w-40 h-40 rounded-full bg-violet-400/20 blur-3xl" aria-hidden="true" />

          {/* Content */}
          <div className="relative h-full flex flex-col justify-between p-10 lg:p-12 text-white">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-lg tracking-tight leading-none">Arsip-Digikan</p>
                <p className="text-[11px] text-white/60 font-medium tracking-wide mt-1">Digital Archive Platform</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur border border-white/15 text-[11px] font-semibold tracking-wide text-white/90">
                <Sparkles className="w-3 h-3" />
                Sistem Arsip Modern
              </div>
              <h2 className="text-3xl lg:text-4xl font-bold tracking-tight leading-tight">
                Digitalisasi arsip,<br />
                <span className="text-gradient bg-gradient-to-r from-indigo-200 via-white to-violet-200 bg-clip-text text-transparent">
                  efisiensi birokrasi.
                </span>
              </h2>
              <p className="text-sm text-white/75 leading-relaxed max-w-md">
                Kelola surat masuk & keluar dengan rapi, cepat, dan aman. Dirancang khusus untuk kebutuhan dinas perikanan.
              </p>
            </div>

            <div className="flex items-center gap-6 text-xs text-white/70">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                <span>Aman & Terenkripsi</span>
              </div>
              <div className="h-4 w-px bg-white/20" />
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span>Cloud Storage</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right form panel */}
        <div className="p-8 sm:p-10 lg:p-12 flex flex-col justify-center bg-white/95">
          <div className="md:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-glow">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-base tracking-tight text-slate-900 leading-none">Arsip-Digikan</p>
              <p className="text-[10px] text-slate-500 font-medium mt-1">Digital Archive Platform</p>
            </div>
          </div>

          <div className="mb-8">
            <span className="inline-block text-[11px] font-bold uppercase tracking-widest text-indigo-600 mb-3">
              Selamat Datang
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mb-2">
              Masuk ke akun Anda
            </h1>
            <p className="text-sm text-slate-500 leading-relaxed">
              Gunakan kredensial yang diberikan administrator untuk mengakses sistem arsip digital.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="flex items-start gap-2 bg-red-50 text-red-700 p-3.5 rounded-xl text-sm font-medium border border-red-100 animate-fade-in-up">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-xs font-bold flex-shrink-0">!</span>
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="username"
                className="text-xs font-semibold text-slate-700 uppercase tracking-wider"
              >
                Username
              </label>
              <Input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="h-12 text-base bg-slate-50/50 border-slate-200 focus:bg-white focus-ring"
                disabled={loading}
                placeholder="Masukkan username"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="text-xs font-semibold text-slate-700 uppercase tracking-wider"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-[11px] font-semibold text-slate-400 hover:text-indigo-600 transition-colors inline-flex items-center gap-1"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {showPassword ? 'Sembunyikan' : 'Lihat'}
                </button>
              </div>
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-12 text-base bg-slate-50/50 border-slate-200 focus:bg-white focus-ring"
                disabled={loading}
                placeholder="Masukkan password"
              />
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full h-12 mt-2 text-sm font-semibold shadow-glow bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Memuat...
                </>
              ) : (
                <>
                  Masuk ke Sistem
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100">
            <p className="text-[11px] text-slate-400 text-center leading-relaxed">
              Sistem Manajemen Arsip Digital Perikanan &copy; {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
