'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  ShieldCheck,
  Calendar,
  Building2,
  Tag,
  ArrowRightLeft,
} from 'lucide-react';

interface VerifyResult {
  found: boolean;
  document?: {
    id: number;
    type: string;
    typeLabel: string;
    title: string;
    referenceNumber: string;
    category: string;
    seksi: string;
    sender: string;
    recipient: string;
    date: string;
    status: string;
    createdAt: string;
  };
}

const TYPE_COLORS: Record<string, string> = {
  INCOMING: 'bg-blue-50 text-blue-700 border-blue-200',
  OUTGOING: 'bg-amber-50 text-amber-700 border-amber-200',
  SURAT_TUGAS: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  SURAT_KEPUTUSAN: 'bg-violet-50 text-violet-700 border-violet-200',
};

export default function VerifyPage() {
  const params = useParams<{ ref: string }>();
  const ref = params?.ref ? decodeURIComponent(params.ref) : '';
  const [data, setData] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!ref) return;
    setLoading(true);
    fetch(`/api/verify/${encodeURIComponent(ref)}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setError('Gagal memverifikasi dokumen'))
      .finally(() => setLoading(false));
  }, [ref]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-violet-50/40 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-lg shadow-indigo-200 mb-4">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1">
            Verifikasi Dokumen
          </h1>
          <p className="text-sm text-slate-500">
            Arsip-Digikan · DPKPP Kab. Mempawah
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/60 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-10 h-10 mx-auto mb-3 animate-spin text-indigo-500" />
              <p className="text-sm font-medium text-slate-600">Memverifikasi...</p>
            </div>
          ) : error ? (
            <div className="p-10 text-center">
              <XCircle className="w-14 h-14 mx-auto mb-4 text-red-400" />
              <p className="font-semibold text-slate-700">{error}</p>
            </div>
          ) : data?.found && data.document ? (
            <div>
              {/* Header */}
              <div className="p-5 sm:p-6 border-b border-slate-100 bg-gradient-to-r from-emerald-50/60 to-teal-50/40">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-emerald-700 text-base">
                      Dokumen Tervervalidasi
                    </p>
                    <p className="text-xs text-emerald-600/80 mt-0.5">
                      Dokumen ini terdaftar resmi dalam sistem arsip
                    </p>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-5 sm:p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-slate-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Judul</p>
                    <p className="text-base font-semibold text-slate-800 leading-snug">
                      {data.document.title}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field
                    icon={<Tag className="w-3.5 h-3.5" />}
                    label="No. Referensi"
                    value={data.document.referenceNumber}
                    mono
                  />
                  <Field
                    icon={<Calendar className="w-3.5 h-3.5" />}
                    label="Tanggal Surat"
                    value={data.document.date}
                  />
                  <Field
                    icon={<Building2 className="w-3.5 h-3.5" />}
                    label="Seksi"
                    value={data.document.seksi}
                  />
                  <Field
                    icon={<ArrowRightLeft className="w-3.5 h-3.5" />}
                    label="Kategori"
                    value={data.document.category}
                  />
                  {data.document.sender && (
                    <Field label="Pengirim" value={data.document.sender} />
                  )}
                  {data.document.recipient && (
                    <Field label="Penerima" value={data.document.recipient} />
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border ${
                      TYPE_COLORS[data.document.type] ||
                      'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {data.document.typeLabel}
                  </span>
                  <span className="inline-flex items-center px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Status: {data.document.status}
                  </span>
                  <span className="ml-auto text-[10px] text-slate-400 font-medium">
                    Diarsipkan: {new Date(data.document.createdAt).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-10 text-center">
              <XCircle className="w-14 h-14 mx-auto mb-4 text-red-400" />
              <p className="font-semibold text-slate-700 text-base">Dokumen tidak ditemukan</p>
              <p className="text-xs mt-1 text-slate-500">
                Nomor referensi <span className="font-mono font-semibold text-slate-700">{ref}</span> tidak terdaftar atau telah dihapus.
              </p>
            </div>
          )}
        </div>

        <p className="text-center text-[10px] text-slate-400 mt-6 font-medium tracking-wide">
          © {new Date().getFullYear()} Arsip-Digikan · Sistem Manajemen Arsip Digital
        </p>
      </div>
    </div>
  );
}

function Field({
  icon,
  label,
  value,
  mono,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="bg-slate-50/70 rounded-xl p-3 border border-slate-100">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className={`text-sm font-semibold text-slate-800 ${mono ? 'font-mono' : ''}`}>
        {value || '-'}
      </p>
    </div>
  );
}
