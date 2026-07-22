export interface User {
  id: number;
  username: string;
  role: string;
}

export type DocumentType = 'INCOMING' | 'OUTGOING' | 'SURAT_TUGAS' | 'SURAT_KEPUTUSAN';
export type DocumentStatus = 'DITERIMA' | 'DIPROSES' | 'SELESAI' | 'DIARSIPKAN';

export interface Attachment {
  id: number;
  document_id: number;
  filename: string;
  storage_ref: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

export interface Document {
  id: number;
  type: DocumentType;
  title: string;
  reference_number: string;
  category: string;
  sender: string;
  recipient: string;
  date: string;
  seksi: string;
  pdf_filename: string;
  status: DocumentStatus;
  text_content?: string | null;
  deleted_at?: string | null;
  created_at: string;
  created_by: number;
  attachments?: Attachment[];
  bookmarked?: boolean;
}

export interface LogEntry {
  id: number;
  action: string;
  document_id: number | null;
  document_title: string | null;
  user_id: number | null;
  username: string | null;
  ip?: string | null;
  detail?: string | null;
  timestamp: string;
}

export interface StorageUsage {
  usedBytes: number;
  limitBytes: number;
  fileCount: number;
  storageType?: 'google-drive' | 'vercel-blob' | 'local';
}
