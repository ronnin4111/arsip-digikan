import os
import subprocess
import sys

LOCAL_DIR = r"C:\Users\BUDIDAYA\arsip-digikan\uploads"
REMOTE_NAME = "gdrive"
REMOTE_FOLDER = "ArsipDigikanLocalBackup"

def sync_archives():
    print(f"[Rclone Sync] Memulai sinkronisasi dari {LOCAL_DIR} ke {REMOTE_NAME}:{REMOTE_FOLDER}...")
    
    if not os.path.exists(LOCAL_DIR):
        print(f"[Rclone Sync] Folder lokal {LOCAL_DIR} belum ada. Tidak ada yang disinkronkan.")
        return

    # Perintah rclone sync: menyamakan folder lokal ke cloud
    cmd = ["rclone", "sync", LOCAL_DIR, f"{REMOTE_NAME}:{REMOTE_FOLDER}", "--progress"]
    
    try:
        result = subprocess.run(cmd, check=True)
        print("[Rclone Sync] Sinkronisasi BERHASIL dan aman!")
    except subprocess.CalledProcessError as e:
        print(f"[Rclone Sync] Sinkronisasi GAGAL dengan kode error {e.returncode}")
    except Exception as e:
        print(f"[Rclone Sync] Terjadi kesalahan: {e}")

if __name__ == "__main__":
    sync_archives()
