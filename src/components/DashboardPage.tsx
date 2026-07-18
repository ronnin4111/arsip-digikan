'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthContext';
import { Document, LogEntry, StorageUsage } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Search,
  LogOut,
  FileText,
  Download,
  Trash2,
  Plus,
  Eye,
  X,
  Edit,
  History,
  Users,
  HardDrive,
} from 'lucide-react';
import DriveSetup from '@/components/DriveSetup';
import { format } from 'date-fns';

interface DashboardProps {
  onAddDocument: () => void;
}

export default function Dashboard({ onAddDocument }: DashboardProps) {
  const { user, token, logout } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [seksiFilter, setSeksiFilter] = useState('');

  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [editDoc, setEditDoc] = useState<Document | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [showUsers, setShowUsers] = useState(false);

  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('user');
  const [userError, setUserError] = useState('');

  const [editUserId, setEditUserId] = useState<number | null>(null);
  const [storageUsage, setStorageUsage] = useState<StorageUsage | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch documents and storage when filters change
  useEffect(() => {
    if (!token) return;

    const params = new URLSearchParams();
    if (search) params.append('q', search);
    if (typeFilter) params.append('type', typeFilter);
    if (categoryFilter) params.append('category', categoryFilter);
    if (dateFilter) params.append('date', dateFilter);
    if (seksiFilter) params.append('seksi', seksiFilter);

    fetch(`/api/documents?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.ok ? res.json() : [])
      .then(data => setDocuments(Array.isArray(data) ? data : []))
      .catch(() => setDocuments([]));
  }, [token, search, typeFilter, categoryFilter, dateFilter, seksiFilter, refreshKey]);

  useEffect(() => {
    if (!token) return;

    fetch(`/api/storage-usage`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setStorageUsage(data); })
      .catch(() => {});
  }, [token, refreshKey]);

  const refreshData = () => setRefreshKey(k => k + 1);

  const fetchLogs = async () => {
    try {
      const res = await fetch(`/api/logs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUsersList = async () => {
    try {
      const res = await fetch(`/api/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUsersList(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError('');

    try {
      const method = editUserId ? 'PUT' : 'POST';
      const url = editUserId ? `/api/users/${editUserId}` : `/api/users`;

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: newUserUsername,
          password: newUserPassword,
          role: newUserRole,
        }),
      });

      if (res.ok) {
        setNewUserUsername('');
        setNewUserPassword('');
        setNewUserRole('user');
        setEditUserId(null);
        fetchUsersList();
      } else {
        const data = await res.json();
        setUserError(data.error || 'Gagal menyimpan pengguna');
      }
    } catch {
      setUserError('Gagal menyimpan pengguna');
    }
  };

  const handleEditUserClick = (u: any) => {
    setEditUserId(u.id);
    setNewUserUsername(u.username);
    setNewUserPassword('');
    setNewUserRole(u.role);
    setUserError('');
  };

  const handleCancelEditUser = () => {
    setEditUserId(null);
    setNewUserUsername('');
    setNewUserPassword('');
    setNewUserRole('user');
    setUserError('');
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus pengguna ini?')) return;
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchUsersList();
      } else {
        const data = await res.json();
        alert(data.error || 'Gagal menghapus pengguna');
      }
    } catch {
      alert('Gagal menghapus pengguna');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus dokumen ini?')) return;
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        refreshData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDoc) return;

    try {
      const res = await fetch(`/api/documents/${editDoc.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editDoc),
      });

      if (res.ok) {
        setEditDoc(null);
        refreshData();
      } else {
        const data = await res.json();
        alert(data.error || 'Gagal menyimpan perubahan');
      }
    } catch {
      alert('Gagal menyimpan perubahan');
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] font-sans flex flex-col">
      {/* Navbar */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 shrink-0 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 flex items-center justify-center rounded-none">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <h1 className="font-bold text-xl tracking-tight text-slate-900">
            ARSIP-<span className="font-light">DIGIKAN</span>
          </h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          {user?.role === 'admin' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowUsers(true);
                fetchUsersList();
              }}
              className="text-xs font-bold text-slate-600 hidden sm:flex"
            >
              <Users className="w-4 h-4 mr-2" />
              Manajemen Pengguna
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setShowLogs(true);
              fetchLogs();
            }}
            className="text-xs font-bold text-slate-600"
          >
            <History className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Log Aktivitas</span>
          </Button>
          <div className="text-right hidden md:block">
            <p className="text-sm font-semibold text-slate-800">{user?.username}</p>
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
              {user?.role}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={logout} className="text-slate-500 hover:text-red-500">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <Card className="rounded-none border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-50 flex items-center justify-center rounded-none">
                    <FileText className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Total Dokumen
                    </p>
                    <p className="text-2xl font-bold text-slate-800">{documents.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-none border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 flex items-center justify-center rounded-none">
                    <Download className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Surat Masuk
                    </p>
                    <p className="text-2xl font-bold text-slate-800">
                      {documents.filter((d) => d.type === 'INCOMING').length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-none border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-50 flex items-center justify-center rounded-none">
                    <FileText className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Surat Keluar
                    </p>
                    <p className="text-2xl font-bold text-slate-800">
                      {documents.filter((d) => d.type === 'OUTGOING').length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-none border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-50 flex items-center justify-center rounded-none">
                    <HardDrive className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Penyimpanan
                    </p>
                    <p className="text-2xl font-bold text-slate-800">
                      {storageUsage ? formatBytes(storageUsage.usedBytes) : '...'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Storage Bar */}
          {storageUsage && (
            <div className="bg-white rounded-none border border-slate-200 p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  Penggunaan Penyimpanan
                  {storageUsage.storageType === 'google-drive' && (
                    <span className="ml-2 text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
                      GOOGLE DRIVE
                    </span>
                  )}
                  {storageUsage.storageType === 'vercel-blob' && (
                    <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">
                      VERCEL BLOB
                    </span>
                  )}
                </span>
                <span className="text-xs text-slate-500">
                  {formatBytes(storageUsage.usedBytes)} / {formatBytes(storageUsage.limitBytes)} (
                  {storageUsage.fileCount} file)
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, (storageUsage.usedBytes / storageUsage.limitBytes) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Drive Setup - shows when Google Drive needs configuration */}
          {user?.role === 'admin' && token && (
            <DriveSetup token={token} />
          )}

          {/* Filters */}
          <Card className="rounded-none border-slate-200">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    className="pl-10 bg-white rounded-none"
                    placeholder="Cari judul atau nomor referensi..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <select
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  <option value="">Semua Tipe</option>
                  <option value="INCOMING">Surat Masuk</option>
                  <option value="OUTGOING">Surat Keluar</option>
                </select>
                <select
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="">Semua Kategori</option>
                  <option value="Segera">Segera</option>
                  <option value="Penting">Penting</option>
                  <option value="Biasa">Biasa</option>
                  <option value="Rahasia">Rahasia</option>
                </select>
                <select
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
                  value={seksiFilter}
                  onChange={(e) => setSeksiFilter(e.target.value)}
                >
                  <option value="">Semua Seksi</option>
                  <option value="Perikanan Budidaya">Perikanan Budidaya</option>
                  <option value="Perikanan Tangkap">Perikanan Tangkap</option>
                  <option value="Seksi Pengolahan dan Pemasaran ikan">
                    Seksi Pengolahan dan Pemasaran ikan
                  </option>
                </select>
                <Input
                  type="date"
                  className="w-auto bg-white rounded-none"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Add Document Button */}
          <div className="flex justify-end">
            <Button onClick={onAddDocument} className="rounded-none shadow-sm">
              <Plus className="w-4 h-4 mr-2" />
              Unggah Dokumen Baru
            </Button>
          </div>

          {/* Documents Table */}
          <Card className="rounded-none border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 p-4">
                      Tipe
                    </th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 p-4">
                      Judul
                    </th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 p-4 hidden md:table-cell">
                      No. Referensi
                    </th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 p-4 hidden lg:table-cell">
                      Kategori
                    </th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 p-4 hidden lg:table-cell">
                      Seksi
                    </th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 p-4 hidden sm:table-cell">
                      Tanggal
                    </th>
                    <th className="text-right text-[10px] font-bold uppercase tracking-widest text-slate-400 p-4">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {documents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-400">
                        <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="font-medium">Belum ada dokumen</p>
                        <p className="text-xs mt-1">Unggah dokumen pertama Anda</p>
                      </td>
                    </tr>
                  ) : (
                    documents.map((doc) => (
                      <tr
                        key={doc.id}
                        className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="p-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                              doc.type === 'INCOMING'
                                ? 'bg-blue-50 text-blue-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {doc.type === 'INCOMING' ? 'Masuk' : 'Keluar'}
                          </span>
                        </td>
                        <td className="p-4">
                          <p className="text-sm font-semibold text-slate-800 line-clamp-1">
                            {doc.title}
                          </p>
                          <p className="text-xs text-slate-400 md:hidden">
                            {doc.reference_number}
                          </p>
                        </td>
                        <td className="p-4 text-sm text-slate-600 hidden md:table-cell">
                          {doc.reference_number}
                        </td>
                        <td className="p-4 hidden lg:table-cell">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              doc.category === 'Segera'
                                ? 'bg-red-50 text-red-700'
                                : doc.category === 'Penting'
                                  ? 'bg-amber-50 text-amber-700'
                                  : doc.category === 'Rahasia'
                                    ? 'bg-purple-50 text-purple-700'
                                    : 'bg-slate-50 text-slate-600'
                            }`}
                          >
                            {doc.category}
                          </span>
                        </td>
                        <td className="p-4 text-sm text-slate-600 hidden lg:table-cell">
                          {doc.seksi}
                        </td>
                        <td className="p-4 text-sm text-slate-600 hidden sm:table-cell">
                          {doc.date}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPreviewDoc(doc)}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-blue-600"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditDoc({ ...doc })}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-emerald-600"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(doc.id)}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 px-6 text-center">
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
          Arsip-Digikan &copy; {new Date().getFullYear()} — Sistem Manajemen Arsip Digital Perikanan
        </p>
      </footer>

      {/* Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] flex flex-col rounded-none">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="font-bold text-lg text-slate-800 truncate pr-4">{previewDoc.title}</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreviewDoc(null)}
                className="shrink-0"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              <iframe
                src={`/api/documents/${previewDoc.id}/preview?token=${token}`}
                className="w-full h-[70vh]"
                title={previewDoc.title}
              />
            </div>
            <div className="p-4 border-t border-slate-200 bg-slate-50">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Tipe</p>
                  <p className="font-medium text-slate-800">
                    {previewDoc.type === 'INCOMING' ? 'Surat Masuk' : 'Surat Keluar'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">No. Referensi</p>
                  <p className="font-medium text-slate-800">{previewDoc.reference_number}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Kategori</p>
                  <p className="font-medium text-slate-800">{previewDoc.category}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Tanggal</p>
                  <p className="font-medium text-slate-800">{previewDoc.date}</p>
                </div>
                {previewDoc.sender && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Pengirim</p>
                    <p className="font-medium text-slate-800">{previewDoc.sender}</p>
                  </div>
                )}
                {previewDoc.recipient && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Penerima</p>
                    <p className="font-medium text-slate-800">{previewDoc.recipient}</p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Seksi</p>
                  <p className="font-medium text-slate-800">{previewDoc.seksi}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editDoc && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-none">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 sticky top-0 bg-white z-10">
              <h3 className="font-bold text-lg text-slate-800">Edit Dokumen</h3>
              <Button variant="ghost" size="sm" onClick={() => setEditDoc(null)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tipe Surat</label>
                  <select
                    className="flex h-10 w-full rounded-md bg-slate-100 border-transparent focus:bg-white focus:ring-2 focus:ring-blue-500 px-3 py-2 text-sm outline-none transition-all"
                    value={editDoc.type}
                    onChange={(e) => setEditDoc({ ...editDoc, type: e.target.value as 'INCOMING' | 'OUTGOING' })}
                  >
                    <option value="INCOMING">Surat Masuk</option>
                    <option value="OUTGOING">Surat Keluar</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Kategori</label>
                  <Input
                    value={editDoc.category}
                    onChange={(e) => setEditDoc({ ...editDoc, category: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Seksi Bidang</label>
                  <select
                    className="flex h-10 w-full rounded-md bg-slate-100 border-transparent focus:bg-white focus:ring-2 focus:ring-blue-500 px-3 py-2 text-sm outline-none transition-all"
                    value={editDoc.seksi}
                    onChange={(e) => setEditDoc({ ...editDoc, seksi: e.target.value })}
                  >
                    <option value="Perikanan Budidaya">Perikanan Budidaya</option>
                    <option value="Perikanan Tangkap">Perikanan Tangkap</option>
                    <option value="Seksi Pengolahan dan Pemasaran ikan">
                      Seksi Pengolahan dan Pemasaran ikan
                    </option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nomor Referensi</label>
                  <Input
                    value={editDoc.reference_number}
                    onChange={(e) => setEditDoc({ ...editDoc, reference_number: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tanggal</label>
                  <Input
                    type="date"
                    value={editDoc.date}
                    onChange={(e) => setEditDoc({ ...editDoc, date: e.target.value })}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-medium">Judul / Perihal</label>
                  <Input
                    value={editDoc.title}
                    onChange={(e) => setEditDoc({ ...editDoc, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Pengirim</label>
                  <Input
                    value={editDoc.sender}
                    onChange={(e) => setEditDoc({ ...editDoc, sender: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Penerima</label>
                  <Input
                    value={editDoc.recipient}
                    onChange={(e) => setEditDoc({ ...editDoc, recipient: e.target.value })}
                  />
                </div>
              </div>
              <div className="pt-4 border-t border-slate-100 flex gap-3 justify-end">
                <Button type="button" variant="outline" onClick={() => setEditDoc(null)}>
                  Batal
                </Button>
                <Button type="submit">Simpan Perubahan</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Logs Modal */}
      {showLogs && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl max-h-[90vh] flex flex-col rounded-none">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="font-bold text-lg text-slate-800">Log Aktivitas</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowLogs(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {logs.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Belum ada log aktivitas</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 sticky top-0">
                      <th className="text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 p-4">Aksi</th>
                      <th className="text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 p-4">Dokumen</th>
                      <th className="text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 p-4">Pengguna</th>
                      <th className="text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 p-4">Waktu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b border-slate-100">
                        <td className="p-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              log.action === 'UPLOAD'
                                ? 'bg-emerald-50 text-emerald-700'
                                : log.action === 'UPDATE'
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'bg-red-50 text-red-700'
                            }`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="p-4 text-sm text-slate-600">{log.document_title || '-'}</td>
                        <td className="p-4 text-sm text-slate-600">{log.username || '-'}</td>
                        <td className="p-4 text-sm text-slate-400">
                          {format(new Date(log.timestamp), 'dd MMM yyyy, HH:mm')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Users Modal */}
      {showUsers && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl max-h-[90vh] flex flex-col rounded-none">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="font-bold text-lg text-slate-800">Manajemen Pengguna</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowUsers(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <Card className="rounded-none border-slate-200">
                <CardContent className="p-4">
                  <h4 className="font-bold text-sm text-slate-800 mb-4">
                    {editUserId ? 'Edit Pengguna' : 'Tambah Pengguna Baru'}
                  </h4>
                  {userError && (
                    <div className="bg-red-50 text-red-500 p-3 rounded-md text-sm mb-4">{userError}</div>
                  )}
                  <form onSubmit={handleAddUser} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Input
                        placeholder="Username"
                        value={newUserUsername}
                        onChange={(e) => setNewUserUsername(e.target.value)}
                        required
                      />
                      <Input
                        type="password"
                        placeholder={editUserId ? 'Password baru (opsional)' : 'Password'}
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        required={!editUserId}
                      />
                      <select
                        className="flex h-10 w-full rounded-md bg-slate-100 border-transparent focus:bg-white focus:ring-2 focus:ring-blue-500 px-3 py-2 text-sm outline-none transition-all"
                        value={newUserRole}
                        onChange={(e) => setNewUserRole(e.target.value)}
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" size="sm">
                        {editUserId ? 'Simpan Perubahan' : 'Tambah Pengguna'}
                      </Button>
                      {editUserId && (
                        <Button type="button" size="sm" variant="outline" onClick={handleCancelEditUser}>
                          Batal
                        </Button>
                      )}
                    </div>
                  </form>
                </CardContent>
              </Card>

              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 p-4">Username</th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 p-4">Role</th>
                    <th className="text-right text-[10px] font-bold uppercase tracking-widest text-slate-400 p-4">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map((u: any) => (
                    <tr key={u.id} className="border-b border-slate-100">
                      <td className="p-4 text-sm font-medium text-slate-800">{u.username}</td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            u.role === 'admin' ? 'bg-blue-50 text-blue-700' : 'bg-slate-50 text-slate-600'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditUserClick(u)}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-emerald-600"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteUser(u.id)}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
