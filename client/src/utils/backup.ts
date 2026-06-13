export const BACKUP_KEYS = [
  'yield_records',
  'yield_settings_v1',
  'yield_capa_v1',
  'yield_measurements_v1',
  'tool_gantt_stations',
  'tool_gantt_completed_elements',
  'tool_gantt_notes',
] as const;

interface BackupPayload {
  version: 1;
  exportedAt: string;
  data: Record<string, string | null>;
}

export function exportBackup(): void {
  const data: Record<string, string | null> = {};
  for (const key of BACKUP_KEYS) {
    data[key] = localStorage.getItem(key);
  }
  const payload: BackupPayload = { version: 1, exportedAt: new Date().toISOString(), data };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `yield-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export function importBackup(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const payload = JSON.parse(e.target?.result as string) as BackupPayload;
        if (!payload.version || !payload.data) throw new Error('Invalid backup file');
        for (const [key, value] of Object.entries(payload.data)) {
          if (value === null) localStorage.removeItem(key);
          else localStorage.setItem(key, value);
        }
        resolve();
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
