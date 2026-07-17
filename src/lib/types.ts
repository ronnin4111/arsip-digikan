export interface User {
  id: number;
  username: string;
  role: string;
}

export interface Document {
  id: number;
  type: 'INCOMING' | 'OUTGOING';
  title: string;
  reference_number: string;
  category: string;
  sender: string;
  recipient: string;
  date: string;
  seksi: string;
  pdf_filename: string;
  created_at: string;
  created_by: number;
}

export interface LogEntry {
  id: number;
  action: string;
  document_id: number | null;
  document_title: string | null;
  user_id: number | null;
  username: string | null;
  timestamp: string;
}

export interface StorageUsage {
  usedBytes: number;
  limitBytes: number;
  fileCount: number;
  storageType?: 'google-drive' | 'vercel-blob';
}
