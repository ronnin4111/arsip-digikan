'use client';

import React, { useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Upload } from 'lucide-react';

interface UploadDocumentProps {
  onBack: () => void;
  onSuccess: () => void;
}

export default function UploadDocument({ onBack, onSuccess }: UploadDocumentProps) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    type: 'INCOMING',
    title: '',
    reference_number: '',
    category: 'Biasa',
    seksi: 'Perikanan Tangkap',
    sender: '',
    recipient: 'Kepala DPKPP Kab. Mempawah',
    date: new Date().toISOString().split('T')[0],
  });
  const [file, setFile] = useState<File | null>(null);

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
          Authorization: `Bearer ${token}`
        },
        body: data
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

  return (
    <div className="min-h-screen bg-[#F1F5F9] py-8 font-sans">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <Button
          variant="ghost"
          className="mb-6 -ml-4 text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-slate-900"
          onClick={onBack}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Kembali
        </Button>

        <Card>
          <CardHeader className="border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="text-lg font-bold text-slate-800 tracking-tight">
              UNGGAH DOKUMEN BARU
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 text-red-500 p-3 rounded-md text-sm">{error}</div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tipe Surat</label>
                  <select
                    className="flex h-10 w-full rounded-md bg-slate-100 border-transparent focus:bg-white focus:ring-2 focus:ring-blue-500 px-3 py-2 text-sm outline-none transition-all"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  >
                    <option value="INCOMING">Surat Masuk</option>
                    <option value="OUTGOING">Surat Keluar</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Kategori</label>
                  <input
                    list="upload-categories"
                    className="flex h-10 w-full rounded-md bg-slate-100 border-transparent focus:bg-white focus:ring-2 focus:ring-blue-500 px-3 py-2 text-sm outline-none transition-all"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="Pilih atau ketik kategori..."
                  />
                  <datalist id="upload-categories">
                    <option value="Segera" />
                    <option value="Penting" />
                    <option value="Biasa" />
                    <option value="Rahasia" />
                  </datalist>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Seksi Bidang</label>
                  <select
                    className="flex h-10 w-full rounded-md bg-slate-100 border-transparent focus:bg-white focus:ring-2 focus:ring-blue-500 px-3 py-2 text-sm outline-none transition-all"
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

                <div className="space-y-2">
                  <label className="text-sm font-medium">Nomor Referensi</label>
                  <Input
                    required
                    value={formData.reference_number}
                    onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                    placeholder="Contoh: 001/SK/2026"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Tanggal Surat</label>
                  <Input
                    required
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-medium">Judul / Perihal</label>
                  <Input
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Masukkan perihal surat"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Pengirim (Opsional)</label>
                  <Input
                    value={formData.sender}
                    onChange={(e) => setFormData({ ...formData, sender: e.target.value })}
                    placeholder="Nama pengirim atau instansi"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Penerima (Opsional)</label>
                  <Input
                    value={formData.recipient}
                    onChange={(e) => setFormData({ ...formData, recipient: e.target.value })}
                    placeholder="Nama penerima atau instansi"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t border-slate-100">
                <label className="text-sm font-medium">File Dokumen (PDF)</label>
                <div className="mt-2 flex justify-center rounded-md border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-10 hover:bg-slate-100 transition-colors">
                  <div className="text-center">
                    <Upload className="mx-auto h-12 w-12 text-slate-300 mb-2" aria-hidden="true" />
                    <div className="mt-4 flex text-xs font-bold uppercase tracking-widest text-slate-500 justify-center">
                      <label
                        htmlFor="file-upload"
                        className="relative cursor-pointer bg-transparent text-blue-600 hover:text-blue-500"
                      >
                        <span>Upload File</span>
                        <input
                          id="file-upload"
                          name="file-upload"
                          type="file"
                          accept="application/pdf"
                          className="sr-only"
                          onChange={(e) => setFile(e.target.files?.[0] || null)}
                        />
                      </label>
                      <p className="pl-1">atau drag &amp; drop</p>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2">MAKSIMAL 10MB (HANYA PDF)</p>
                    {file && (
                      <p className="mt-4 text-xs font-bold text-emerald-600 uppercase">
                        TERPILIH: {file.name}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <Button type="submit" className="w-full sm:w-auto" disabled={loading}>
                  {loading ? 'Mengunggah...' : 'Simpan Dokumen'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
