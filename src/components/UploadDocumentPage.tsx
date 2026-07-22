'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/components/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Upload,
  FileText,
  CheckCircle2,
  Loader2,
  Save,
  X,
  CloudUpload,
  AlertTriangle,
} from 'lucide-react';

interface UploadDocumentProps {
  onBack: () => void;
  onSuccess: () => void;
}

export default function UploadDocument({ onBack, onSuccess }: UploadDocumentProps) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Duplicate reference number detection state
  const [refCheck, setRefCheck] = useState<{
    loading: boolean;
    exists: boolean;
    duplicate: { id: number; title: string; date: string } | null;
  }>({ loading: false, exists: false, duplicate: null });

  const [formData, setFormData] = useState({
    type: 'INCOMING',
    title: '',
    reference_number: '',
    category: '',
    seksi: 'Bidang Perikanan',
    sender: '',
    recipient: 'Kepala DPKPP Kab. Mempawah',
    date: new Date().toISOString().split('T')[0],
  });
  const [file, setFile] = useState<File | null>(null);

  // === Real-time duplicate reference number check ===
  // Debounced: waits 400ms after the user stops typing before hitting the API.
  useEffect(() => {
    const refNum = formData.reference_number.trim();
    if (!refNum) {
      setRefCheck({ loading: false, exists: false, duplicate: null });
      return;
    }
    setRefCheck({ loading: true, exists: false, duplicate: null });
    const t = setTimeout(async () => {
      try {
        const url = `/api/documents/check-ref?reference_number=${encodeURIComponent(refNum)}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('check failed');
        const data = await res.json();
        setRefCheck({
          loading: false,
          exists: !!data.exists,
          duplicate: data.duplicate,
        });
      } catch {
        // Silently fail — server-side check on submit is the source of truth
        setRefCheck({ loading: false, exists: false, duplicate: null });
      }
    }, 400);
    return () => clearTimeout(t);
  }, [formData.reference_number, token]);

  const handleFileChange = (f: File | null) => {
    if (f && f.type !== 'application/pdf') {
      setError('Hanya file PDF yang diperbolehkan');
      return;
    }
    if (f && f.size > 10 * 1024 * 1024) {
      setError('Ukuran file maksimal 10MB');
      return;
    }
    setError('');
    setFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0] || null;
    handleFileChange(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Pilih file PDF terlebih dahulu');
      return;
    }

    setError('');
    setLoading(true);

    const data = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      data.append(key, value);
    });
    data.append('pdf', file);

    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: data,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal mengunggah dokumen');
      }

      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal mengunggah dokumen');
      setLoading(false);
    }
  };

  const isDuplicate = !!(refCheck.exists && refCheck.duplicate);

  return (
    <div className="min-h-screen mesh-bg py-8 font-sans">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <Button
          variant="ghost"
          className="mb-6 -ml-3 text-xs font-semibold uppercase tracking-wider text-slate-600 hover:text-slate-900 hover:bg-white/60 rounded-lg"
          onClick={onBack}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Kembali ke Dashboard
        </Button>

        {/* Header */}
        <div className="mb-6 animate-fade-in-up">
          <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-2">
            Tambah Arsip Baru
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mb-1">
            Unggah Dokumen
          </h1>
          <p className="text-sm text-slate-500">
            Lengkapi detail dokumen di bawah ini, lalu unggah file PDF.
          </p>
        </div>

        <Card className="rounded-2xl border-slate-200/60 shadow-soft-md overflow-hidden animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/30 p-5">
            <CardTitle className="text-base font-bold text-slate-800 tracking-tight flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                <FileText className="w-4 h-4 text-white" />
              </div>
              Detail Dokumen
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 sm:p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="flex items-start gap-2 bg-red-50 text-red-700 p-3.5 rounded-xl text-sm font-medium border border-red-100 animate-fade-in-up">
                  <span className="mt-0.5 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-xs font-bold flex-shrink-0">!</span>
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Tipe Surat
                  </label>
                  <select
                    className="flex h-11 w-full rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus-ring px-3 py-2 text-sm outline-none transition-all cursor-pointer"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  >
                    <option value="INCOMING">Surat Masuk</option>
                    <option value="OUTGOING">Surat Keluar</option>
                    <option value="SURAT_TUGAS">Surat Tugas</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Kategori
                  </label>
                  <input
                    list="upload-categories"
                    className="flex h-11 w-full rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus-ring px-3 py-2 text-sm outline-none transition-all"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="Pilih atau ketik kategori..."
                  />
                  <datalist id="upload-categories">
                    <option value="Segera" />
                    <option value="Penting" />
                    <option value="Biasa" />
                    <option value="Rahasia" />
                    <option value="Surat Tugas" />
                  </datalist>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Seksi Bidang
                  </label>
                  <select
                    className="flex h-11 w-full rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus-ring px-3 py-2 text-sm outline-none transition-all cursor-pointer"
                    value={formData.seksi}
                    onChange={(e) => setFormData({ ...formData, seksi: e.target.value })}
                  >
                    <option value="Perikanan Budidaya">Perikanan Budidaya</option>
                    <option value="Perikanan Tangkap">Perikanan Tangkap</option>
                    <option value="Seksi Pengolahan dan Pemasaran ikan">
                      Seksi Pengolahan dan Pemasaran ikan
                    </option>
                    <option value="Bidang Perikanan">Bidang Perikanan</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Nomor Referensi
                  </label>
                  <Input
                    required
                    className={`h-11 bg-slate-50 border-slate-200 focus:bg-white focus-ring font-mono ${
                      isDuplicate ? 'border-red-400 bg-red-50/40' : ''
                    }`}
                    value={formData.reference_number}
                    onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                    placeholder="Contoh: 001/SK/2026"
                  />
                  {refCheck.loading && formData.reference_number.trim() && (
                    <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Memeriksa nomor surat...
                    </p>
                  )}
                  {isDuplicate && refCheck.duplicate && (
                    <div className="flex items-start gap-2 bg-red-50 text-red-700 p-2.5 rounded-lg text-xs font-medium border border-red-100 mt-1">
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      <div>
                        <p>Nomor surat ini sudah dipakai dokumen lain:</p>
                        <p className="font-mono mt-1 text-red-800">
                          ID #{refCheck.duplicate.id} · {refCheck.duplicate.date}
                        </p>
                        <p className="mt-0.5 text-red-600 line-clamp-2">
                          {refCheck.duplicate.title}
                        </p>
                      </div>
                    </div>
                  )}
                  {!refCheck.loading && !isDuplicate && formData.reference_number.trim().length >= 3 && (
                    <p className="text-xs text-emerald-600 flex items-center gap-1.5 mt-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Nomor surat tersedia
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Tanggal Surat
                  </label>
                  <Input
                    required
                    type="date"
                    className="h-11 bg-slate-50 border-slate-200 focus:bg-white focus-ring"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Judul / Perihal
                  </label>
                  <Input
                    required
                    className="h-11 bg-slate-50 border-slate-200 focus:bg-white focus-ring"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Masukkan perihal surat"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Pengirim <span className="text-slate-400 normal-case font-normal">(opsional)</span>
                  </label>
                  <Input
                    className="h-11 bg-slate-50 border-slate-200 focus:bg-white focus-ring"
                    value={formData.sender}
                    onChange={(e) => setFormData({ ...formData, sender: e.target.value })}
                    placeholder="Nama pengirim atau instansi"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Penerima <span className="text-slate-400 normal-case font-normal">(opsional)</span>
                  </label>
                  <Input
                    className="h-11 bg-slate-50 border-slate-200 focus:bg-white focus-ring"
                    value={formData.recipient}
                    onChange={(e) => setFormData({ ...formData, recipient: e.target.value })}
                    placeholder="Nama penerima atau instansi"
                  />
                </div>
              </div>

              {/* Modern Drop Zone */}
              <div className="pt-5 border-t border-slate-100">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3 block">
                  File Dokumen (PDF)
                </label>

                {!file ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                    className={`relative cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-300 px-6 py-12 text-center group ${
                      dragging
                        ? 'border-indigo-500 bg-indigo-50/60 scale-[1.01]'
                        : 'border-slate-300 bg-slate-50/50 hover:border-indigo-400 hover:bg-indigo-50/30'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf"
                      className="sr-only"
                      onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                    />
                    <div
                      className={`mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300 ${
                        dragging
                          ? 'bg-gradient-to-br from-indigo-500 to-violet-600 scale-110 shadow-glow'
                          : 'bg-gradient-to-br from-slate-200 to-slate-300 group-hover:from-indigo-100 group-hover:to-violet-100'
                      }`}
                    >
                      <CloudUpload
                        className={`w-8 h-8 transition-colors ${
                          dragging ? 'text-white' : 'text-slate-500 group-hover:text-indigo-600'
                        }`}
                      />
                    </div>
                    <p className="text-sm font-semibold text-slate-700 mb-1">
                      {dragging ? 'Lepaskan file di sini' : 'Klik atau drag & drop file PDF'}
                    </p>
                    <p className="text-xs text-slate-400">
                      Maksimal 10MB · Hanya format PDF
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50/50 p-4 flex items-center gap-3 animate-scale-in">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-emerald-200">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{file.name}</p>
                      <p className="text-xs text-emerald-700 flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="w-3 h-3" />
                        {(file.size / 1024 / 1024).toFixed(2)} MB · Siap diunggah
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setFile(null)}
                      className="h-9 w-9 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="pt-6 flex flex-col sm:flex-row gap-3 sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onBack}
                  className="h-11 px-5 rounded-xl order-2 sm:order-1"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={loading || isDuplicate}
                  className="h-11 px-6 rounded-xl shadow-glow bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 transition-all duration-300 hover:-translate-y-0.5 order-1 sm:order-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Mengunggah...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Simpan Dokumen
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
