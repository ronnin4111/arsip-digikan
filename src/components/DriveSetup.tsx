'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  HardDrive,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Copy,
  Loader2,
  RefreshCw,
  Info,
} from 'lucide-react';

interface DriveTestResult {
  configured: boolean;
  authMethod: 'oauth2' | 'service-account' | 'none';
  folderId: string;
  folderAccessible: boolean;
  folderName?: string;
  isInSharedDrive?: boolean;
  canUpload: boolean;
  uploadError?: string;
  existingFileCount?: number;
  errors: string[];
  warnings: string[];
  instructions: string[];
}

interface DriveSetupProps {
  token: string;
}

export default function DriveSetup({ token }: DriveSetupProps) {
  const [driveStatus, setDriveStatus] = useState<DriveTestResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [authCode, setAuthCode] = useState('');
  const [exchanging, setExchanging] = useState(false);
  const [exchangeResult, setExchangeResult] = useState<{ success: boolean; message: string; refreshToken?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [setupStep, setSetupStep] = useState(0);
  const [testTrigger, setTestTrigger] = useState(0);

  // Fetch drive status - triggered by token change or manual test
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true); // eslint-disable-line react-hooks/set-state-in-effect -- initial data fetch
    fetch('/api/drive-test', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (cancelled || !data) return;
        setDriveStatus(data);
        if (data.errors.length > 0 || !data.canUpload) {
          setExpanded(true);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token, testTrigger]);

  const testDrive = () => setTestTrigger(t => t + 1);

  const startOAuthFlow = () => {
    // Open the OAuth authorization URL in a new tab
    window.open('/api/auth/google?redirect=app', '_blank');
  };

  const startPlaygroundFlow = () => {
    // Open the OAuth Playground flow
    window.open('/api/auth/google?redirect=playground', '_blank');
  };

  const exchangeCode = async () => {
    if (!authCode.trim()) return;
    setExchanging(true);
    setExchangeResult(null);
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: authCode.trim() }),
      });
      const data = await res.json();
      if (data.refresh_token) {
        setExchangeResult({
          success: true,
          message: 'Refresh token berhasil didapatkan!',
          refreshToken: data.refresh_token,
        });
        setSetupStep(4);
      } else {
        setExchangeResult({
          success: false,
          message: data.error || 'Gagal mendapatkan refresh token.',
        });
      }
    } catch {
      setExchangeResult({
        success: false,
        message: 'Gagal menukar kode otorisasi.',
      });
    }
    setExchanging(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="bg-white/80 backdrop-blur rounded-2xl border border-slate-200/60 shadow-soft p-4">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
          <span className="text-sm text-slate-500 font-medium">Memeriksa koneksi Google Drive...</span>
        </div>
      </div>
    );
  }

  if (!driveStatus) return null;

  const isWorking = driveStatus.canUpload && driveStatus.folderAccessible;
  const needsOAuth2 = driveStatus.authMethod === 'service-account' && !driveStatus.isInSharedDrive && !driveStatus.canUpload;
  const needsSetup = !driveStatus.configured || driveStatus.errors.length > 0;

  // If everything is working, show a minimal status
  if (isWorking) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 shadow-soft">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-semibold text-emerald-700">
              Google Drive Terhubung
            </span>
            <span className="text-xs text-emerald-600">
              ({driveStatus.authMethod === 'oauth2' ? 'OAuth2' : 'Service Account'} • {driveStatus.folderName || driveStatus.folderId})
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={testDrive}
            className="h-7 text-xs text-emerald-600 hover:text-emerald-700"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Tes Ulang
          </Button>
        </div>
      </div>
    );
  }

  // Show setup panel when there are issues
  return (
    <div className="bg-white rounded-2xl border-2 border-amber-200 overflow-hidden shadow-soft">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 bg-amber-50 cursor-pointer hover:bg-amber-100/60 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          {needsOAuth2 ? (
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          ) : (
            <XCircle className="w-5 h-5 text-red-500" />
          )}
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              Google Drive Perlu Konfigurasi
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {needsOAuth2
                ? 'Service Account tidak bisa upload ke folder personal. Gunakan OAuth2.'
                : driveStatus.errors.length > 0
                ? driveStatus.errors[0]
                : 'Google Drive belum dikonfigurasi dengan benar.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); testDrive(); }}
            className="h-7 text-xs text-slate-500"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Tes Ulang
          </Button>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Diagnostic Info */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-50 p-2 rounded-lg">
              <span className="text-slate-400 block">Metode Auth</span>
              <span className="font-medium text-slate-700">
                {driveStatus.authMethod === 'oauth2' ? 'OAuth2 ✓' :
                 driveStatus.authMethod === 'service-account' ? 'Service Account' : 'Tidak ada'}
              </span>
            </div>
            <div className="bg-slate-50 p-2 rounded-lg">
              <span className="text-slate-400 block">Folder</span>
              <span className="font-medium text-slate-700">
                {driveStatus.folderAccessible ? (
                  <span className="text-emerald-600">✓ {driveStatus.folderName || 'Accessible'}</span>
                ) : (
                  <span className="text-red-500">✗ Tidak bisa akses</span>
                )}
              </span>
            </div>
            <div className="bg-slate-50 p-2 rounded-lg">
              <span className="text-slate-400 block">Shared Drive</span>
              <span className="font-medium text-slate-700">
                {driveStatus.isInSharedDrive ? 'Ya ✓' : 'Tidak (My Drive)'}
              </span>
            </div>
            <div className="bg-slate-50 p-2 rounded-lg">
              <span className="text-slate-400 block">Upload Test</span>
              <span className="font-medium text-slate-700">
                {driveStatus.canUpload ? (
                  <span className="text-emerald-600">✓ Berhasil</span>
                ) : (
                  <span className="text-red-500">✗ Gagal</span>
                )}
              </span>
            </div>
          </div>

          {/* Error details */}
          {driveStatus.uploadError && (
            <div className="bg-red-50 border border-red-100 p-3 rounded text-xs text-red-700">
              <strong>Detail Error:</strong> {driveStatus.uploadError}
            </div>
          )}

          {/* Setup Instructions - OAuth2 for personal accounts */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-soft">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
              <h4 className="text-sm font-bold text-slate-700">
                Setup OAuth2 untuk Akun Gmail Pribadi
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Ikuti langkah-langkah berikut untuk menghubungkan Google Drive Anda
              </p>
            </div>

            <div className="p-4 space-y-4">
              {/* Step 1: Configure OAuth Consent Screen */}
              <div className={`flex gap-3 ${setupStep >= 0 ? '' : 'opacity-50'}`}>
                <div className="flex-shrink-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    setupStep > 0 ? 'bg-emerald-500 text-white' : 'bg-blue-500 text-white'
                  }`}>
                    {setupStep > 0 ? '✓' : '1'}
                  </div>
                </div>
                <div className="flex-1">
                  <h5 className="text-sm font-medium text-slate-800">
                    Konfigurasi OAuth Consent Screen
                  </h5>
                  <div className="mt-2 space-y-2 text-xs text-slate-600">
                    <p>Buka <a href="https://console.cloud.google.com/apis/credentials/consent" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline inline-flex items-center gap-1">Google Cloud Console → OAuth consent screen <ExternalLink className="w-3 h-3" /></a></p>
                    <ol className="list-decimal list-inside space-y-1 ml-2">
                      <li>Pilih <strong>User Type: External</strong> → klik Create</li>
                      <li>Isi App name (misal: &quot;Arsip-Digikan&quot;) dan email Anda</li>
                      <li>Di bagian <strong>Scopes</strong>, tambahkan <code>.../auth/drive</code></li>
                      <li>Di bagian <strong>Test Users</strong>, tambahkan email Gmail Anda</li>
                      <li>Klik <strong>Save and Continue</strong> sampai selesai</li>
                    </ol>
                    <div className="bg-blue-50 border border-blue-100 p-2 rounded mt-1">
                      <Info className="w-3 h-3 inline text-blue-500" /> <strong>Penting:</strong> Set User Type ke &quot;External&quot; dan tambahkan email Anda sebagai Test User. Tanpa ini, akan muncul Error 403: access_denied.
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 text-xs h-7"
                    onClick={() => setSetupStep(1)}
                  >
                    Sudah Selesai →
                  </Button>
                </div>
              </div>

              {/* Step 2: Add redirect URI */}
              <div className={`flex gap-3 ${setupStep >= 1 ? '' : 'opacity-50'}`}>
                <div className="flex-shrink-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    setupStep > 1 ? 'bg-emerald-500 text-white' : 'bg-blue-500 text-white'
                  }`}>
                    {setupStep > 1 ? '✓' : '2'}
                  </div>
                </div>
                <div className="flex-1">
                  <h5 className="text-sm font-medium text-slate-800">
                    Tambahkan Redirect URI di OAuth Client
                  </h5>
                  <div className="mt-2 space-y-2 text-xs text-slate-600">
                    <p>Buka <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline inline-flex items-center gap-1">Google Cloud Console → Credentials <ExternalLink className="w-3 h-3" /></a></p>
                    <ol className="list-decimal list-inside space-y-1 ml-2">
                      <li>Klik OAuth Client ID Anda untuk mengedit</li>
                      <li>Di bagian <strong>Authorized redirect URIs</strong>, tambahkan:</li>
                    </ol>
                    <div className="bg-slate-50 p-2 rounded-lg font-mono text-xs break-all border border-slate-200">
                      <code id="redirect-uri">{typeof window !== 'undefined' ? `${window.location.origin}/api/auth/google/callback` : '/api/auth/google/callback'}</code>
                      <button
                        onClick={() => copyToClipboard(typeof window !== 'undefined' ? `${window.location.origin}/api/auth/google/callback` : '')}
                        className="ml-2 text-blue-500 hover:text-blue-700"
                      >
                        <Copy className="w-3 h-3 inline" />
                        {copied ? ' Copied!' : ''}
                      </button>
                    </div>
                    <li className="list-decimal list-inside ml-2">Klik <strong>Save</strong></li>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 text-xs h-7"
                    onClick={() => setSetupStep(2)}
                  >
                    Sudah Selesai →
                  </Button>
                </div>
              </div>

              {/* Step 3: Authorize */}
              <div className={`flex gap-3 ${setupStep >= 2 ? '' : 'opacity-50'}`}>
                <div className="flex-shrink-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    setupStep > 2 ? 'bg-emerald-500 text-white' : 'bg-blue-500 text-white'
                  }`}>
                    {setupStep > 2 ? '✓' : '3'}
                  </div>
                </div>
                <div className="flex-1">
                  <h5 className="text-sm font-medium text-slate-800">
                    Otorisasi Akses Google Drive
                  </h5>
                  <div className="mt-2 space-y-2 text-xs text-slate-600">
                    <p>Klik tombol di bawah untuk mengotorisasi aplikasi mengakses Google Drive Anda.</p>
                    <p>Anda akan diarahkan ke halaman Google untuk memberikan izin.</p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="text-xs h-8 bg-blue-600 hover:bg-blue-700"
                      onClick={startOAuthFlow}
                      disabled={setupStep < 2}
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Otorisasi Google Drive
                    </Button>
                    <span className="text-xs text-slate-400 self-center">atau</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8"
                      onClick={startPlaygroundFlow}
                      disabled={setupStep < 2}
                    >
                      Pakai OAuth Playground
                    </Button>
                  </div>

                  {/* Playground code exchange */}
                  <div className="mt-3 border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                    <p className="text-xs font-medium text-slate-700 mb-2">
                      Jika menggunakan OAuth Playground, paste kode otorisasi di sini:
                    </p>
                    <div className="flex gap-2">
                      <Input
                        className="text-xs h-8 flex-1"
                        placeholder="Paste authorization code..."
                        value={authCode}
                        onChange={(e) => setAuthCode(e.target.value)}
                      />
                      <Button
                        size="sm"
                        className="text-xs h-8"
                        onClick={exchangeCode}
                        disabled={exchanging || !authCode.trim()}
                      >
                        {exchanging ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          'Tukar Kode'
                        )}
                      </Button>
                    </div>
                    {exchangeResult && (
                      <div className={`mt-2 p-2 rounded text-xs ${
                        exchangeResult.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                      }`}>
                        {exchangeResult.success ? (
                          <>
                            <CheckCircle className="w-3 h-3 inline mr-1" />
                            {exchangeResult.message}
                            {exchangeResult.refreshToken && (
                              <div className="mt-1 bg-slate-800 text-cyan-300 p-2 rounded font-mono break-all text-[10px]">
                                <button
                                  onClick={() => copyToClipboard(exchangeResult.refreshToken!)}
                                  className="float-right text-slate-400 hover:text-white"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                                {exchangeResult.refreshToken}
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 inline mr-1" />
                            {exchangeResult.message}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 text-xs h-7"
                    onClick={() => setSetupStep(3)}
                  >
                    Sudah Dapat Refresh Token →
                  </Button>
                </div>
              </div>

              {/* Step 4: Set env var */}
              <div className={`flex gap-3 ${setupStep >= 3 ? '' : 'opacity-50'}`}>
                <div className="flex-shrink-0">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-blue-500 text-white">
                    4
                  </div>
                </div>
                <div className="flex-1">
                  <h5 className="text-sm font-medium text-slate-800">
                    Simpan Refresh Token di Vercel
                  </h5>
                  <div className="mt-2 space-y-2 text-xs text-slate-600">
                    <ol className="list-decimal list-inside space-y-1 ml-2">
                      <li>Buka <strong>Vercel Dashboard</strong> → Project → Settings → Environment Variables</li>
                      <li>Tambahkan variable baru:</li>
                    </ol>
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 space-y-1">
                      <div>Name: <code className="bg-white px-1 rounded">GOOGLE_REFRESH_TOKEN</code></div>
                      <div>Value: <em>(paste refresh token yang didapat dari langkah 3)</em></div>
                    </div>
                    <li className="list-decimal list-inside ml-2">
                      <strong>Redeploy</strong> project di Vercel
                    </li>
                  </div>
                  <div className="bg-amber-50 border border-amber-100 p-2 rounded mt-2 text-xs text-amber-700">
                    <AlertTriangle className="w-3 h-3 inline mr-1" />
                    Setelah menambahkan GOOGLE_REFRESH_TOKEN dan redeploy, Google Drive akan otomatis menggunakan OAuth2 (prioritas lebih tinggi dari Service Account).
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
