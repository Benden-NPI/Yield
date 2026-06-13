import { useEffect } from 'react';

export const WRITEBACK_URL_KEY = 'tool_gantt_writeback_url';
export const USERNAME_KEY = 'tool_gantt_username';
const RETRY_QUEUE_KEY = 'tool_gantt_push_queue';

export interface PushItem {
  key: string;
  completed: boolean;
  note: string;
  by: string;
  updatedAt: string;
}

export function getWritebackUrl(): string {
  try { return localStorage.getItem(WRITEBACK_URL_KEY) ?? ''; } catch { return ''; }
}

export function setWritebackUrl(url: string): void {
  try {
    if (url) localStorage.setItem(WRITEBACK_URL_KEY, url);
    else localStorage.removeItem(WRITEBACK_URL_KEY);
  } catch {}
}

export function getUserName(): string {
  try { return localStorage.getItem(USERNAME_KEY) ?? ''; } catch { return ''; }
}

export function setUserName(name: string): void {
  try {
    if (name.trim()) localStorage.setItem(USERNAME_KEY, name.trim());
    else localStorage.removeItem(USERNAME_KEY);
  } catch {}
}

function loadQueue(): PushItem[] {
  try {
    const raw = localStorage.getItem(RETRY_QUEUE_KEY);
    return raw ? (JSON.parse(raw) as PushItem[]) : [];
  } catch { return []; }
}

function saveQueue(queue: PushItem[]): void {
  try { localStorage.setItem(RETRY_QUEUE_KEY, JSON.stringify(queue)); } catch {}
}

async function pushOne(url: string, item: PushItem): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Enqueue a status update and fire-and-forget to the write-back webhook.
 * If the push fails the item stays in the retry queue (flushed on next mount).
 * Safe to call outside React (not a hook).
 */
export function enqueuePush(item: PushItem): void {
  const queue = loadQueue();
  const idx = queue.findIndex((q) => q.key === item.key);
  if (idx >= 0) queue[idx] = item;
  else queue.push(item);
  saveQueue(queue);

  const url = getWritebackUrl();
  if (!url) return;
  pushOne(url, item).then((ok) => {
    if (ok) {
      const q = loadQueue().filter((q) => q.key !== item.key);
      saveQueue(q);
    }
  });
}

/**
 * Hook: flush the retry queue once on mount.
 * Mount inside ToolGanttTab (runs when user navigates to the tab).
 */
export function useReadinessFlush(): void {
  useEffect(() => {
    const url = getWritebackUrl();
    if (!url) return;
    const queue = loadQueue();
    if (queue.length === 0) return;
    for (const item of [...queue]) {
      pushOne(url, item).then((ok) => {
        if (ok) {
          const q = loadQueue().filter((q) => q.key !== item.key);
          saveQueue(q);
        }
      });
    }
  }, []);
}
