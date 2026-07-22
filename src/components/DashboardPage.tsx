'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthContext';
import { Document, LogEntry, StorageUsage, DocumentStatus } from '@/lib/types';
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
  ArrowDownLeft,
  ArrowUpRight,
  Inbox,
  Loader2,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Star,
  Gavel,
  Sun,
  Moon,
  Trash,
  RotateCcw,
  QrCode,
  FilePlus,
  MapPin,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
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
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [seksiFilter, setSeksiFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showBookmarksOnly, setShowBookmarksOnly] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [previewShowDetails, setPreviewShowDetails] = useState(true);
  const [previewShowQr, setPreviewShowQr] = useState(true);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
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
  const [loadingDocs, setLoadingDocs] = useState(true);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(10);

  // Fetch documents and storage when filters change
  useEffect(() => {
    if (!token) return;
    setLoadingDocs(true);

    const params = new URLSearchParams();
    if (search) params.append('q', search);
    if (typeFilter) params.append('type', typeFilter);
    if (categoryFilter) params.append('category', categoryFilter);
    if (dateFilter) params.append('date', dateFilter);
    if (dateFromFilter) params.append('dateFrom', dateFromFilter);
    if (dateToFilter) params.append('dateTo', dateToFilter);
    if (seksiFilter) params.append('seksi', seksiFilter);
    if (statusFilter) params.append('status', statusFilter);
    if (showTrash) params.append('includeTrash', 'true');
    if (showBookmarksOnly) params.append('bookmarkedOnly', 'true');

    fetch(`/api/documents?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.ok ? res.json() : [])
      .then(data => setDocuments(Array.isArray(data) ? data : []))
      .catch(() => setDocuments([]))
      .finally(() => setLoadingDocs(false));
  }, [token, search, typeFilter, categoryFilter, dateFilter, dateFromFilter, dateToFilter, seksiFilter, statusFilter, refreshKey, showTrash, showBookmarksOnly]);

  // Dark mode persistence + apply class to documentElement
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('darkMode') : null;
    if (stored === 'true') {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
  }, [darkMode]);

  // Quick date range filters
  const setQuickDateRange = (months: number) => {
    const today = new Date();
    const to = today.toISOString().split('T')[0];
    const from = new Date(today.getFullYear(), today.getMonth() - months + 1, 1).toISOString().split('T')[0];
    setDateFromFilter(from);
    setDateToFilter(to);
    setDateFilter('');
  };
  const setThisYear = () => {
    const year = new Date().getFullYear();
    setDateFromFilter(`${year}-01-01`);
    setDateToFilter(`${year}-12-31`);
    setDateFilter('');
  };
  const clearDateFilters = () => {
    setDateFilter('');
    setDateFromFilter('');
    setDateToFilter('');
  };

  // Toggle bookmark
  const toggleBookmark = async (docId: number) => {
    try {
      const res = await fetch(`/api/documents/${docId}/bookmark`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDocuments(prev => prev.map(d => d.id === docId ? { ...d, bookmarked: data.bookmarked } : d));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Soft delete (move to trash)
  const handleDelete = async (id: number) => {
    if (!confirm('Pindahkan dokumen ke Trash? Anda bisa memulihkannya nanti.')) return;
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

  // Restore from trash
  const handleRestore = async (id: number) => {
    try {
      const res = await fetch(`/api/documents/${id}/restore`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        refreshData();
      } else {
        const data = await res.json();
        alert(data.error || 'Gagal memulihkan');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Permanently delete (purge)
  const handlePurge = async (id: number) => {
    if (!confirm('HAPUS PERMANEN? Dokumen dan file tidak bisa dikembalikan.')) return;
    try {
      const res = await fetch(`/api/documents/${id}/purge`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        refreshData();
      } else {
        const data = await res.json();
        alert(data.error || 'Gagal menghapus permanen');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Logout with API log
  const handleLogout = async () => {
    try {
      await fetch('/api/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (e) {
      // ignore
    }
    logout();
  };

  // Export current filtered data
  const handleExport = async (format: 'xlsx' | 'csv') => {
    const params = new URLSearchParams();
    if (search) params.append('q', search);
    if (typeFilter) params.append('type', typeFilter);
    if (categoryFilter) params.append('category', categoryFilter);
    if (dateFromFilter) params.append('dateFrom', dateFromFilter);
    if (dateToFilter) params.append('dateTo', dateToFilter);
    if (seksiFilter) params.append('seksi', seksiFilter);
    if (statusFilter) params.append('status', statusFilter);
    params.append('format', format);

    const a = document.createElement('a');
    a.href = `/api/documents/export?${params.toString()}&token=${token}`;
    a.click();
  };

  // Reset to page 1 whenever filters or page size change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, typeFilter, categoryFilter, dateFilter, seksiFilter, pageSize, refreshKey]);

  // Pagination computations
  const totalDocs = documents.length;
  const totalPages = Math.max(1, Math.ceil(totalDocs / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const endIdx = startIdx + pageSize;
  const paginatedDocuments = documents.slice(startIdx, endIdx);
  const pagesToShow = (() => {
    // Show up to 5 page numbers around the current page
    const maxButtons = 5;
    const half = Math.floor(maxButtons / 2);
    let start = Math.max(1, safePage - half);
    let end = Math.min(totalPages, start + maxButtons - 1);
    if (end - start + 1 < maxButtons) {
      start = Math.max(1, end - maxButtons + 1);
    }
    const arr: number[] = [];
    for (let i = start; i <= end; i++) arr.push(i);
    return arr;
  })();

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

  const totalIncoming = documents.filter((d) => d.type === 'INCOMING').length;
  const totalOutgoing = documents.filter((d) => d.type === 'OUTGOING').length;
  const totalTugas = documents.filter((d) => d.type === 'SURAT_TUGAS').length;

  return (
    <div className="min-h-screen mesh-bg font-sans flex flex-col">
      {/* Navbar */}
      <header className="sticky top-0 z-30 glass border-b border-slate-200/60">
        <div className="h-16 max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-glow">
              <FileText className="w-4.5 h-4.5 text-white" />
            </div>
            <div className="flex flex-col">
              <h1 className="font-bold text-base sm:text-lg tracking-tight text-slate-900 leading-none">
                Arsip-<span className="font-light text-slate-500">Digikan</span>
              </h1>
              <span className="hidden sm:block text-[10px] text-slate-400 font-medium tracking-wide mt-0.5">
                Digital Archive Platform
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {user?.role === 'admin' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowUsers(true);
                  fetchUsersList();
                }}
                className="hidden sm:inline-flex h-9 text-xs font-semibold text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all"
              >
                <Users className="w-3.5 h-3.5 mr-1.5 text-indigo-500" />
                Pengguna
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowLogs(true);
                fetchLogs();
              }}
              className="h-9 text-xs font-semibold text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all"
            >
              <History className="w-3.5 h-3.5 sm:mr-1.5 text-violet-500" />
              <span className="hidden sm:inline">Log Aktivitas</span>
            </Button>

            {/* Bookmark filter toggle */}
            <Button
              variant={showBookmarksOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowBookmarksOnly((v) => !v)}
              className={`h-9 text-xs font-semibold transition-all ${
                showBookmarksOnly
                  ? 'bg-amber-500 hover:bg-amber-600 border-amber-500 text-white'
                  : 'text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
              }`}
              title="Tampilkan favorit saja"
            >
              <Star className={`w-3.5 h-3.5 sm:mr-1.5 ${showBookmarksOnly ? 'fill-white' : 'text-amber-500'}`} />
              <span className="hidden sm:inline">Favorit</span>
            </Button>

            {/* Trash toggle */}
            <Button
              variant={showTrash ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowTrash((v) => !v)}
              className={`h-9 text-xs font-semibold transition-all ${
                showTrash
                  ? 'bg-red-500 hover:bg-red-600 border-red-500 text-white'
                  : 'text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
              }`}
              title="Lihat Trash"
            >
              <Trash className="w-3.5 h-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Trash</span>
            </Button>

            {/* Dark mode toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDarkMode((v) => !v)}
              className="h-9 w-9 p-0 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
              title={darkMode ? 'Mode terang' : 'Mode gelap'}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>

            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50/80 border border-slate-200/60">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-xs font-bold">
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-slate-800 leading-none">{user?.username}</p>
                <p className="text-[10px] text-slate-500 uppercase font-medium tracking-wider mt-0.5">
                  {user?.role}
                </p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="h-9 w-9 p-0 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header row */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 animate-fade-in-up">
            <div>
              <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-1">
                Dashboard
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                Selamat datang, {user?.username} 👋
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Berikut ringkasan arsip dan dokumen perikanan Anda hari ini.
              </p>
            </div>
            <Button
              onClick={onAddDocument}
              className="h-11 px-5 text-sm font-semibold shadow-glow bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 transition-all duration-300 hover:-translate-y-0.5"
            >
              <Plus className="w-4 h-4 mr-2" />
              Unggah Dokumen
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            {/* Total Documents */}
            <Card
              className="card-hover rounded-2xl border-slate-200/60 shadow-soft overflow-hidden animate-fade-in-up"
              style={{ animationDelay: '50ms' }}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-200">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Total
                  </span>
                </div>
                <p className="text-3xl font-bold text-slate-900 leading-none tracking-tight">
                  {documents.length}
                </p>
                <p className="text-xs text-slate-500 mt-1.5 font-medium">Total Dokumen</p>
              </CardContent>
            </Card>

            {/* Incoming */}
            <Card
              className="card-hover rounded-2xl border-slate-200/60 shadow-soft overflow-hidden animate-fade-in-up"
              style={{ animationDelay: '100ms' }}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-md shadow-blue-200">
                    <ArrowDownLeft className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Masuk
                  </span>
                </div>
                <p className="text-3xl font-bold text-slate-900 leading-none tracking-tight">
                  {totalIncoming}
                </p>
                <p className="text-xs text-slate-500 mt-1.5 font-medium">Surat Masuk</p>
              </CardContent>
            </Card>

            {/* Outgoing */}
            <Card
              className="card-hover rounded-2xl border-slate-200/60 shadow-soft overflow-hidden animate-fade-in-up"
              style={{ animationDelay: '150ms' }}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md shadow-amber-200">
                    <ArrowUpRight className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Keluar
                  </span>
                </div>
                <p className="text-3xl font-bold text-slate-900 leading-none tracking-tight">
                  {totalOutgoing}
                </p>
                <p className="text-xs text-slate-500 mt-1.5 font-medium">Surat Keluar</p>
              </CardContent>
            </Card>

            {/* Surat Tugas */}
            <Card
              className="card-hover rounded-2xl border-slate-200/60 shadow-soft overflow-hidden animate-fade-in-up"
              style={{ animationDelay: '175ms' }}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-200">
                    <Briefcase className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Tugas
                  </span>
                </div>
                <p className="text-3xl font-bold text-slate-900 leading-none tracking-tight">
                  {totalTugas}
                </p>
                <p className="text-xs text-slate-500 mt-1.5 font-medium">Surat Tugas</p>
              </CardContent>
            </Card>

            {/* Storage */}
            <Card
              className="card-hover rounded-2xl border-slate-200/60 shadow-soft overflow-hidden animate-fade-in-up"
              style={{ animationDelay: '200ms' }}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center shadow-md shadow-violet-200">
                    <HardDrive className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Storage
                  </span>
                </div>
                <p className="text-3xl font-bold text-slate-900 leading-none tracking-tight">
                  {storageUsage ? formatBytes(storageUsage.usedBytes) : '...'}
                </p>
                <p className="text-xs text-slate-500 mt-1.5 font-medium">Penyimpanan</p>
              </CardContent>
            </Card>
          </div>

          {/* Storage Bar */}
          {storageUsage && (
            <Card className="rounded-2xl border-slate-200/60 shadow-soft animate-fade-in-up" style={{ animationDelay: '250ms' }}>
              <CardContent className="p-5">
                <div className="flex flex-wrap justify-between items-center mb-3 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Penggunaan Penyimpanan
                    </span>
                    {storageUsage.storageType === 'google-drive' && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold border border-emerald-200">
                        Google Drive
                      </span>
                    )}
                    {storageUsage.storageType === 'vercel-blob' && (
                      <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold border border-amber-200">
                        Vercel Blob
                      </span>
                    )}
                    {storageUsage.storageType === 'local' && (
                      <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold border border-indigo-200">
                        Local Storage
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500 font-medium tabular-nums">
                    {formatBytes(storageUsage.usedBytes)} / {formatBytes(storageUsage.limitBytes)} ·{' '}
                    <span className="text-slate-400">{storageUsage.fileCount} file</span>
                  </span>
                </div>
                <div className="relative h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${Math.min(100, (storageUsage.usedBytes / storageUsage.limitBytes) * 100)}%`,
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Drive Setup - shows when Google Drive needs configuration */}
          {user?.role === 'admin' && token && (
            <DriveSetup token={token} />
          )}

          {/* Filters */}
          <Card className="rounded-2xl border-slate-200/60 shadow-soft animate-fade-in-up" style={{ animationDelay: '300ms' }}>
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-col lg:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    className="pl-10 h-11 bg-slate-50/50 border-slate-200 focus:bg-white focus-ring"
                    placeholder="Cari judul atau nomor referensi..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 focus-ring hover:border-slate-300 transition-colors cursor-pointer"
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                  >
                    <option value="">Semua Tipe</option>
                    <option value="INCOMING">Surat Masuk</option>
                    <option value="OUTGOING">Surat Keluar</option>
                    <option value="SURAT_TUGAS">Surat Tugas</option>
                    <option value="SURAT_KEPUTUSAN">Surat Keputusan</option>
                  </select>
                  <select
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 focus-ring hover:border-slate-300 transition-colors cursor-pointer"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                  >
                    <option value="">Semua Kategori</option>
                    <option value="Segera">Segera</option>
                    <option value="Penting">Penting</option>
                    <option value="Biasa">Biasa</option>
                    <option value="Rahasia">Rahasia</option>
                    <option value="Surat Tugas">Surat Tugas</option>
                    <option value="Surat Keputusan">Surat Keputusan</option>
                  </select>
                  <select
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 focus-ring hover:border-slate-300 transition-colors cursor-pointer"
                    value={seksiFilter}
                    onChange={(e) => setSeksiFilter(e.target.value)}
                  >
                    <option value="">Semua Seksi</option>
                    <option value="Perikanan Budidaya">Perikanan Budidaya</option>
                    <option value="Perikanan Tangkap">Perikanan Tangkap</option>
                    <option value="Seksi Pengolahan dan Pemasaran ikan">
                      Pengolahan & Pemasaran
                    </option>
                    <option value="Bidang Perikanan">Bidang Perikanan</option>
                  </select>
                  <select
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 focus-ring hover:border-slate-300 transition-colors cursor-pointer"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="">Semua Status</option>
                    <option value="DITERIMA">Diterima</option>
                    <option value="DIPROSES">Diproses</option>
                    <option value="SELESAI">Selesai</option>
                    <option value="DIARSIPKAN">Diarsipkan</option>
                  </select>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="date"
                      className="h-11 w-auto bg-white border-slate-200 focus-ring"
                      value={dateFromFilter}
                      onChange={(e) => { setDateFromFilter(e.target.value); setDateFilter(''); }}
                      title="Dari tanggal"
                      aria-label="Dari tanggal"
                    />
                    <span className="text-xs text-slate-400">→</span>
                    <Input
                      type="date"
                      className="h-11 w-auto bg-white border-slate-200 focus-ring"
                      value={dateToFilter}
                      onChange={(e) => { setDateToFilter(e.target.value); setDateFilter(''); }}
                      title="Sampai tanggal"
                      aria-label="Sampai tanggal"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setQuickDateRange(1)}
                      className="h-9 text-[11px] font-semibold"
                    >
                      Bulan ini
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setQuickDateRange(3)}
                      className="h-9 text-[11px] font-semibold"
                    >
                      3 Bulan
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={setThisYear}
                      className="h-9 text-[11px] font-semibold"
                    >
                      Tahun ini
                    </Button>
                    {(dateFromFilter || dateToFilter || dateFilter) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={clearDateFilters}
                        className="h-9 text-[11px] font-semibold text-slate-500"
                      >
                        Reset
                      </Button>
                    )}
                  </div>
                  {/* Export buttons */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport('xlsx')}
                    className="h-11 text-xs font-semibold text-emerald-700 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 transition-all"
                    title="Export ke Excel"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Excel
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport('csv')}
                    className="h-11 text-xs font-semibold text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all"
                    title="Export ke CSV"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    CSV
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Documents Table */}
          <Card className="rounded-2xl border-slate-200/60 shadow-soft overflow-hidden animate-fade-in-up" style={{ animationDelay: '350ms' }}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200">
                    <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 p-4">
                      Tipe
                    </th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 p-4">
                      Judul
                    </th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 p-4 hidden md:table-cell">
                      No. Referensi
                    </th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 p-4 hidden lg:table-cell">
                      Kategori
                    </th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 p-4 hidden lg:table-cell">
                      Seksi
                    </th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 p-4 hidden sm:table-cell">
                      Tanggal
                    </th>
                    <th className="text-right text-[10px] font-bold uppercase tracking-wider text-slate-500 p-4">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loadingDocs ? (
                    <tr>
                      <td colSpan={7} className="text-center py-16 text-slate-400">
                        <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-indigo-400" />
                        <p className="text-sm font-medium">Memuat dokumen...</p>
                      </td>
                    </tr>
                  ) : documents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-16 text-slate-400">
                        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                          <Inbox className="w-8 h-8 text-slate-300" />
                        </div>
                        <p className="font-semibold text-slate-600 text-base">Belum ada dokumen</p>
                        <p className="text-xs mt-1 text-slate-400">
                          Klik tombol "Unggah Dokumen" untuk menambah arsip pertama Anda
                        </p>
                      </td>
                    </tr>
                  ) : paginatedDocuments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-16 text-slate-400">
                        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                          <Inbox className="w-8 h-8 text-slate-300" />
                        </div>
                        <p className="font-semibold text-slate-600 text-base">Tidak ada dokumen pada halaman ini</p>
                        <p className="text-xs mt-1 text-slate-400">
                          Coba ubah filter atau pindah ke halaman lain
                        </p>
                      </td>
                    </tr>
                  ) : (
                    paginatedDocuments.map((doc, idx) => (
                      <tr
                        key={doc.id}
                        className="border-b border-slate-100 hover:bg-indigo-50/30 transition-colors group"
                        style={{ animationDelay: `${idx * 30}ms` }}
                      >
                        <td className="p-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full ${
                              doc.type === 'INCOMING'
                                ? 'bg-blue-50 text-blue-700 border border-blue-100'
                                : doc.type === 'OUTGOING'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                  : doc.type === 'SURAT_TUGAS'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                    : 'bg-violet-50 text-violet-700 border border-violet-100'
                            }`}
                          >
                            {doc.type === 'INCOMING' ? (
                              <ArrowDownLeft className="w-3 h-3" />
                            ) : doc.type === 'OUTGOING' ? (
                              <ArrowUpRight className="w-3 h-3" />
                            ) : doc.type === 'SURAT_TUGAS' ? (
                              <Briefcase className="w-3 h-3" />
                            ) : (
                              <Gavel className="w-3 h-3" />
                            )}
                            {doc.type === 'INCOMING' ? 'Masuk' : doc.type === 'OUTGOING' ? 'Keluar' : doc.type === 'SURAT_TUGAS' ? 'Tugas' : 'SK'}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleBookmark(doc.id)}
                              className={`flex-shrink-0 transition-all hover:scale-110 ${
                                doc.bookmarked ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'
                              }`}
                              title={doc.bookmarked ? 'Hapus dari favorit' : 'Tambah ke favorit'}
                            >
                              <Star className={`w-4 h-4 ${doc.bookmarked ? 'fill-amber-400' : ''}`} />
                            </button>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-800 line-clamp-1 group-hover:text-indigo-700 transition-colors">
                                {doc.title}
                              </p>
                              <p className="text-xs text-slate-400 md:hidden mt-0.5">
                                {doc.reference_number}
                              </p>
                            </div>
                          </div>
                          {doc.attachments && doc.attachments.length > 0 && (
                            <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-indigo-600 font-semibold">
                              <FilePlus className="w-3 h-3" />
                              {doc.attachments.length} lampiran
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-sm text-slate-600 hidden md:table-cell font-mono">
                          {doc.reference_number}
                        </td>
                        <td className="p-4 hidden lg:table-cell">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full ${
                              doc.category === 'Segera'
                                ? 'bg-red-50 text-red-700 border border-red-100'
                                : doc.category === 'Penting'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                  : doc.category === 'Rahasia'
                                    ? 'bg-purple-50 text-purple-700 border border-purple-100'
                                    : doc.category === 'Surat Tugas'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                      : 'bg-slate-50 text-slate-600 border border-slate-100'
                            }`}
                          >
                            {doc.category}
                          </span>
                        </td>
                        <td className="p-4 text-sm text-slate-600 hidden lg:table-cell">
                          {doc.seksi}
                        </td>
                        <td className="p-4 text-sm text-slate-500 hidden sm:table-cell tabular-nums">
                          {doc.date}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-end gap-1">
                            {showTrash ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRestore(doc.id)}
                                  className="h-9 w-9 p-0 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                  title="Pulihkan"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handlePurge(doc.id)}
                                  className="h-9 w-9 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                  title="Hapus permanen"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setPreviewDoc(doc)}
                                  className="h-9 w-9 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                  title="Lihat"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditDoc({ ...doc })}
                                  className="h-9 w-9 p-0 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                  title="Edit"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(doc.id)}
                                  className="h-9 w-9 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                  title="Pindahkan ke trash"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            {!loadingDocs && totalDocs > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-slate-100 bg-slate-50/40">
                <div className="flex items-center gap-3 text-xs text-slate-600 font-medium">
                  <span>
                    Menampilkan{' '}
                    <span className="font-bold text-slate-800 tabular-nums">{startIdx + 1}</span>
                    {'\u2013'}
                    <span className="font-bold text-slate-800 tabular-nums">
                      {Math.min(endIdx, totalDocs)}
                    </span>{' '}
                    dari <span className="font-bold text-slate-800 tabular-nums">{totalDocs}</span> dokumen
                  </span>
                  <select
                    className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 focus-ring hover:border-slate-300 transition-colors cursor-pointer"
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value) as 10 | 20 | 50)}
                  >
                    <option value={10}>10 / halaman</option>
                    <option value={20}>20 / halaman</option>
                    <option value={50}>50 / halaman</option>
                  </select>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={safePage <= 1}
                      onClick={() => setCurrentPage(1)}
                      className="h-9 w-9 p-0 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label="Halaman pertama"
                    >
                      <ChevronsLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={safePage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="h-9 w-9 p-0 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label="Halaman sebelumnya"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    {pagesToShow.map((p) => (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p)}
                        className={`h-9 min-w-[2.25rem] px-2 rounded-lg text-xs font-bold tabular-nums transition-all ${
                          p === safePage
                            ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-glow'
                            : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={safePage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="h-9 w-9 p-0 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label="Halaman berikutnya"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={safePage >= totalPages}
                      onClick={() => setCurrentPage(totalPages)}
                      className="h-9 w-9 p-0 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label="Halaman terakhir"
                    >
                      <ChevronsRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/60 py-5 px-6 text-center mt-auto">
        <p className="text-[11px] text-slate-400 font-medium tracking-wide">
          Arsip-Digikan &copy; {new Date().getFullYear()} · Sistem Manajemen Arsip Digital Perikanan
        </p>
      </footer>

      {/* Preview Modal */}
      {previewDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in-up"
          onClick={() => {
            setPreviewDoc(null);
            setPreviewShowDetails(true);
            setPreviewShowQr(true);
            setPreviewFullscreen(false);
          }}
        >
          <div
            className={`bg-white flex flex-col rounded-2xl shadow-soft-lg overflow-hidden animate-scale-in transition-all duration-300 ${
              previewFullscreen
                ? 'w-full max-w-[95vw] h-[95vh]'
                : 'w-full max-w-4xl max-h-[90vh]'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 bg-slate-50/50 flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-bold text-base sm:text-lg text-slate-800 truncate">
                  {previewDoc.title}
                </h3>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Toggle: Detail */}
                <Button
                  variant={previewShowDetails ? 'outline' : 'ghost'}
                  size="sm"
                  className={`text-xs h-9 rounded-lg ${previewShowDetails ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : ''}`}
                  onClick={() => setPreviewShowDetails((v) => !v)}
                  title="Tampilkan/sembunyikan keterangan dokumen"
                >
                  {previewShowDetails ? <ChevronUp className="w-3.5 h-3.5 mr-1.5" /> : <ChevronDown className="w-3.5 h-3.5 mr-1.5" />}
                  Detail
                </Button>
                {/* Toggle: QR */}
                <Button
                  variant={previewShowQr ? 'outline' : 'ghost'}
                  size="sm"
                  className={`text-xs h-9 rounded-lg ${previewShowQr ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : ''}`}
                  onClick={() => setPreviewShowQr((v) => !v)}
                  title="Tampilkan/sembunyikan QR Code"
                >
                  <QrCode className="w-3.5 h-3.5 mr-1.5" />
                  QR
                </Button>
                {/* Toggle: Fullscreen */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPreviewFullscreen((v) => !v)}
                  className="h-9 w-9 p-0 rounded-lg hover:bg-slate-100"
                  title={previewFullscreen ? 'Keluar dari layar penuh' : 'Layar penuh'}
                >
                  {previewFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </Button>
                {/* Unduh */}
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-9 rounded-lg"
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = `/api/documents/${previewDoc.id}/download?token=${token}`;
                    a.download = `${previewDoc.title}.pdf`;
                    a.click();
                  }}
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Unduh
                </Button>
                {/* Close */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPreviewDoc(null);
                    setPreviewShowDetails(true);
                    setPreviewShowQr(true);
                    setPreviewFullscreen(false);
                  }}
                  className="h-9 w-9 p-0 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Body: iframe fills remaining space + optional QR overlay */}
            <div className="flex-1 overflow-hidden relative bg-slate-100 min-h-0">
              <iframe
                src={`/api/documents/${previewDoc.id}/preview?token=${token}`}
                className="w-full h-full"
                title={previewDoc.title}
              />
              {/* Floating QR overlay — doesn't take vertical space */}
              {previewShowQr && (
                <div className="absolute bottom-3 right-3 bg-white rounded-xl shadow-lg border border-slate-200 p-2.5 flex items-center gap-2.5 max-w-[280px] animate-fade-in-up">
                  <img
                    src={`/api/documents/${previewDoc.id}/qr?token=${token}`}
                    alt="QR Code"
                    className="w-16 h-16 rounded-md"
                  />
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <QrCode className="w-2.5 h-2.5" />
                      QR Verifikasi
                    </p>
                    <p className="text-[10px] text-slate-600 leading-tight mt-0.5">
                      Scan untuk verifikasi keaslian
                    </p>
                    <a
                      href={`/verify/${encodeURIComponent(previewDoc.reference_number)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-[10px] font-semibold text-indigo-600 hover:text-indigo-700 mt-0.5"
                    >
                      Buka halaman →
                    </a>
                  </div>
                  <button
                    onClick={() => setPreviewShowQr(false)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-700 text-white flex items-center justify-center hover:bg-slate-800"
                    title="Sembunyikan QR"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Collapsible Detail footer */}
            {previewShowDetails && (
              <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50/50 flex-shrink-0 max-h-[35vh] overflow-y-auto">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Tipe</p>
                    <p className="font-semibold text-slate-800">
                      {previewDoc.type === 'INCOMING' ? 'Surat Masuk' : previewDoc.type === 'OUTGOING' ? 'Surat Keluar' : previewDoc.type === 'SURAT_TUGAS' ? 'Surat Tugas' : 'Surat Keputusan'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">No. Referensi</p>
                    <p className="font-semibold text-slate-800 font-mono">{previewDoc.reference_number}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Kategori</p>
                    <p className="font-semibold text-slate-800">{previewDoc.category}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Tanggal</p>
                    <p className="font-semibold text-slate-800 tabular-nums">{previewDoc.date}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Status</p>
                    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full ${
                      previewDoc.status === 'DITERIMA'
                        ? 'bg-blue-50 text-blue-700 border border-blue-100'
                        : previewDoc.status === 'DIPROSES'
                          ? 'bg-amber-50 text-amber-700 border border-amber-100'
                          : previewDoc.status === 'SELESAI'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : 'bg-slate-50 text-slate-700 border border-slate-100'
                    }`}>
                      {previewDoc.status || 'DIARSIPKAN'}
                    </span>
                  </div>
                  {previewDoc.sender && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Pengirim</p>
                      <p className="font-semibold text-slate-800">{previewDoc.sender}</p>
                    </div>
                  )}
                  {previewDoc.recipient && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Penerima</p>
                      <p className="font-semibold text-slate-800">{previewDoc.recipient}</p>
                    </div>
                  )}
                  <div className="col-span-2 sm:col-span-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Seksi</p>
                    <p className="font-semibold text-slate-800">{previewDoc.seksi}</p>
                  </div>
                  {previewDoc.physical_location && (
                    <div className="col-span-2 sm:col-span-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        Lokasi Arsip Fisik
                      </p>
                      <p className="font-semibold text-slate-800 bg-amber-50/60 border border-amber-100 rounded-lg px-2 py-1 inline-block">
                        {previewDoc.physical_location}
                      </p>
                    </div>
                  )}
                </div>

                {/* Attachments row */}
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
                    <FilePlus className="w-3 h-3" />
                    Lampiran ({previewDoc.attachments?.length || 0})
                  </p>
                  {previewDoc.attachments && previewDoc.attachments.length > 0 ? (
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                      {previewDoc.attachments.map((att) => (
                        <div key={att.id} className="flex items-center gap-2 bg-white rounded-lg p-2 border border-slate-100">
                          <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span className="text-xs font-medium text-slate-700 truncate flex-1">{att.filename}</span>
                          <span className="text-[10px] text-slate-400 flex-shrink-0">
                            {(att.file_size / 1024).toFixed(0)} KB
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">Tidak ada lampiran tambahan</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in-up"
          onClick={() => setEditDoc(null)}
        >
          <div
            className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-soft-lg animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-200 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                  <Edit className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-bold text-lg text-slate-800">Edit Dokumen</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditDoc(null)}
                className="h-9 w-9 p-0 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-5 sm:p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Tipe Surat</label>
                  <select
                    className="flex h-11 w-full rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus-ring px-3 py-2 text-sm outline-none transition-all cursor-pointer"
                    value={editDoc.type}
                    onChange={(e) => setEditDoc({ ...editDoc, type: e.target.value as 'INCOMING' | 'OUTGOING' | 'SURAT_TUGAS' | 'SURAT_KEPUTUSAN' })}
                  >
                    <option value="INCOMING">Surat Masuk</option>
                    <option value="OUTGOING">Surat Keluar</option>
                    <option value="SURAT_TUGAS">Surat Tugas</option>
                    <option value="SURAT_KEPUTUSAN">Surat Keputusan</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Kategori</label>
                  <Input
                    className="h-11 bg-slate-50 border-slate-200 focus:bg-white focus-ring"
                    value={editDoc.category}
                    onChange={(e) => setEditDoc({ ...editDoc, category: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Seksi Bidang</label>
                  <select
                    className="flex h-11 w-full rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus-ring px-3 py-2 text-sm outline-none transition-all cursor-pointer"
                    value={editDoc.seksi}
                    onChange={(e) => setEditDoc({ ...editDoc, seksi: e.target.value })}
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
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Status</label>
                  <select
                    className="flex h-11 w-full rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus-ring px-3 py-2 text-sm outline-none transition-all cursor-pointer"
                    value={editDoc.status || 'DIARSIPKAN'}
                    onChange={(e) => setEditDoc({ ...editDoc, status: e.target.value as DocumentStatus })}
                  >
                    <option value="DITERIMA">Diterima</option>
                    <option value="DIPROSES">Diproses</option>
                    <option value="SELESAI">Selesai</option>
                    <option value="DIARSIPKAN">Diarsipkan</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Nomor Referensi</label>
                  <Input
                    className="h-11 bg-slate-50 border-slate-200 focus:bg-white focus-ring font-mono"
                    value={editDoc.reference_number}
                    onChange={(e) => setEditDoc({ ...editDoc, reference_number: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Tanggal</label>
                  <Input
                    type="date"
                    className="h-11 bg-slate-50 border-slate-200 focus:bg-white focus-ring"
                    value={editDoc.date}
                    onChange={(e) => setEditDoc({ ...editDoc, date: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Judul / Perihal</label>
                  <Input
                    className="h-11 bg-slate-50 border-slate-200 focus:bg-white focus-ring"
                    value={editDoc.title}
                    onChange={(e) => setEditDoc({ ...editDoc, title: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Pengirim</label>
                  <Input
                    className="h-11 bg-slate-50 border-slate-200 focus:bg-white focus-ring"
                    value={editDoc.sender}
                    onChange={(e) => setEditDoc({ ...editDoc, sender: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Penerima</label>
                  <Input
                    className="h-11 bg-slate-50 border-slate-200 focus:bg-white focus-ring"
                    value={editDoc.recipient}
                    onChange={(e) => setEditDoc({ ...editDoc, recipient: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    Lokasi Arsip Fisik
                  </label>
                  <Input
                    className="h-11 bg-slate-50 border-slate-200 focus:bg-white focus-ring"
                    value={editDoc.physical_location || ''}
                    onChange={(e) => setEditDoc({ ...editDoc, physical_location: e.target.value })}
                    placeholder="cth: Lemari A-3 · Rak 2 · Map Hijau · Urut 12"
                  />
                </div>
              </div>
              <div className="pt-4 border-t border-slate-100 flex gap-3 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditDoc(null)}
                  className="h-11 px-5 rounded-xl"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  className="h-11 px-5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-glow"
                >
                  Simpan Perubahan
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Logs Modal */}
      {showLogs && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in-up"
          onClick={() => setShowLogs(false)}
        >
          <div
            className="bg-white w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl shadow-soft-lg overflow-hidden animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                  <History className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-bold text-lg text-slate-800">Log Aktivitas</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowLogs(false)}
                className="h-9 w-9 p-0 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {logs.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                    <History className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="font-semibold text-slate-600 text-base">Belum ada log aktivitas</p>
                  <p className="text-xs mt-1 text-slate-400">Aktivitas akan muncul di sini</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 sticky top-0">
                      <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 p-4">Aksi</th>
                      <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 p-4">Dokumen</th>
                      <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 p-4">Pengguna</th>
                      <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 p-4">Waktu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => {
                      const actionColor = (a: string) => {
                        if (a === 'UPLOAD' || a === 'LOGIN' || a === 'RESTORE') return 'bg-emerald-50 text-emerald-700 border border-emerald-100';
                        if (a === 'UPDATE' || a === 'VIEW' || a === 'DOWNLOAD') return 'bg-blue-50 text-blue-700 border border-blue-100';
                        if (a === 'DELETE' || a === 'PURGE' || a === 'LOGOUT' || a === 'FAILED_LOGIN') return 'bg-red-50 text-red-700 border border-red-100';
                        return 'bg-slate-50 text-slate-700 border border-slate-100';
                      };
                      return (
                      <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full ${actionColor(log.action)}`}>
                            {log.action}
                          </span>
                          {log.detail && (
                            <p className="text-[10px] text-slate-400 mt-1 italic line-clamp-1">{log.detail}</p>
                          )}
                        </td>
                        <td className="p-4 text-sm text-slate-600 font-medium">{log.document_title || '-'}</td>
                        <td className="p-4 text-sm text-slate-600">{log.username || '-'}{log.ip && <p className="text-[10px] text-slate-400 mt-0.5">{log.ip}</p>}</td>
                        <td className="p-4 text-sm text-slate-400 tabular-nums">
                          {format(new Date(log.timestamp), 'dd MMM yyyy, HH:mm')}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Users Modal */}
      {showUsers && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in-up"
          onClick={() => setShowUsers(false)}
        >
          <div
            className="bg-white w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl shadow-soft-lg overflow-hidden animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
                  <Users className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-bold text-lg text-slate-800">Manajemen Pengguna</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowUsers(false)}
                className="h-9 w-9 p-0 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
              <Card className="rounded-2xl border-slate-200 shadow-soft">
                <CardContent className="p-5">
                  <h4 className="font-bold text-sm text-slate-800 mb-4 flex items-center gap-2">
                    {editUserId ? <Edit className="w-4 h-4 text-emerald-500" /> : <Plus className="w-4 h-4 text-indigo-500" />}
                    {editUserId ? 'Edit Pengguna' : 'Tambah Pengguna Baru'}
                  </h4>
                  {userError && (
                    <div className="bg-red-50 text-red-700 p-3 rounded-xl text-sm mb-4 border border-red-100 font-medium">
                      {userError}
                    </div>
                  )}
                  <form onSubmit={handleAddUser} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Input
                        placeholder="Username"
                        value={newUserUsername}
                        onChange={(e) => setNewUserUsername(e.target.value)}
                        required
                        className="h-11 bg-slate-50 border-slate-200 focus:bg-white focus-ring"
                      />
                      <Input
                        type="password"
                        placeholder={editUserId ? 'Password baru (opsional)' : 'Password'}
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        required={!editUserId}
                        className="h-11 bg-slate-50 border-slate-200 focus:bg-white focus-ring"
                      />
                      <select
                        className="flex h-11 w-full rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus-ring px-3 py-2 text-sm outline-none transition-all cursor-pointer"
                        value={newUserRole}
                        onChange={(e) => setNewUserRole(e.target.value)}
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        size="sm"
                        className="h-10 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-glow"
                      >
                        {editUserId ? 'Simpan Perubahan' : 'Tambah Pengguna'}
                      </Button>
                      {editUserId && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={handleCancelEditUser}
                          className="h-10 rounded-xl"
                        >
                          Batal
                        </Button>
                      )}
                    </div>
                  </form>
                </CardContent>
              </Card>

              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200">
                    <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 p-4">Username</th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 p-4">Role</th>
                    <th className="text-right text-[10px] font-bold uppercase tracking-wider text-slate-500 p-4">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map((u: any) => (
                    <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 text-sm font-semibold text-slate-800">{u.username}</td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full ${
                            u.role === 'admin'
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                              : 'bg-slate-50 text-slate-600 border border-slate-100'
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
                            className="h-9 w-9 p-0 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteUser(u.id)}
                            className="h-9 w-9 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
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
