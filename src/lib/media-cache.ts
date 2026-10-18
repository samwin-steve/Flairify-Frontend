/** Session-only media URLs. Active consumers pin entries; limits apply to idle entries. */
export type MediaSnapshot = Readonly<{ url: string; error: boolean }>;
export const EMPTY_MEDIA: MediaSnapshot = { url: "", error: false };
type Entry = {
  key: string;
  catalog: boolean;
  snapshot: MediaSnapshot;
  users: number;
  bytes: number;
  used: number;
  controller: AbortController;
  pending: boolean;
  timer?: ReturnType<typeof setTimeout>;
};

export class MediaCache {
  account: string | null = null;
  revision = 0;
  private entries = new Map<string, Entry>();
  private listeners = new Set<() => void>();
  constructor(
    private maxBytes = 32 * 1024 * 1024,
    private maxEntries = 64,
    private idleMs = 5 * 60 * 1000,
  ) {}
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private notify() { this.listeners.forEach((listener) => listener()); }
  private key(account: string, id: string, catalog: boolean) {
    return JSON.stringify([account, catalog ? "catalog" : "private", id]);
  }
  setAccount(account: string | null) {
    if (account === this.account) return;
    this.entries.forEach((entry) => this.remove(entry));
    this.account = account;
    this.revision++;
    this.notify();
  }
  snapshot(account: string | null, id: string, catalog = false): MediaSnapshot {
    if (!account || account !== this.account) return EMPTY_MEDIA;
    return this.entries.get(this.key(account, id, catalog))?.snapshot || EMPTY_MEDIA;
  }
  retain(account: string, id: string, catalog: boolean, load: (signal: AbortSignal) => Promise<Blob>) {
    if (account !== this.account) return () => {};
    const key = this.key(account, id, catalog);
    let entry = this.entries.get(key);
    if (!entry) {
      entry = { key, catalog, snapshot: EMPTY_MEDIA, users: 0, bytes: 0,
        used: Date.now(), controller: new AbortController(), pending: false };
      this.entries.set(key, entry);
    }
    const current = entry;
    clearTimeout(current.timer);
    current.users++;
    current.used = Date.now();
    if (!current.snapshot.url && !current.pending) {
      current.pending = true;
      current.snapshot = EMPTY_MEDIA;
      void Promise.resolve().then(() => {
        if (current.controller.signal.aborted) throw new Error("Media request cancelled");
        return load(current.controller.signal);
      }).then((blob) => {
        // Aborted loaders may still resolve. Never publish into a newer session/entry.
        if (this.entries.get(key) !== current || current.controller.signal.aborted) return;
        current.snapshot = { url: URL.createObjectURL(blob), error: false };
        current.bytes = blob.size;
      }).catch(() => {
        if (this.entries.get(key) === current && !current.controller.signal.aborted)
          current.snapshot = { url: "", error: true };
      }).finally(() => {
        current.pending = false;
        this.trim();
        this.notify();
      });
    }
    this.trim();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      current.users--;
      current.used = Date.now();
      if (!current.users && this.entries.get(key) === current) {
        current.timer = setTimeout(() => {
          this.remove(current);
          this.notify();
        }, this.idleMs);
        this.trim();
      }
    };
  }
  /** Photo/wardrobe deletion can cascade to crops and previews; invalidate private media together. */
  invalidatePrivate(account: string | null) {
    if (!account || account !== this.account) return;
    this.entries.forEach((entry) => { if (!entry.catalog) this.remove(entry); });
    this.revision++;
    this.notify();
  }
  invalidate(account: string | null, id: string, catalog = false) {
    if (!account || account !== this.account) return;
    const entry = this.entries.get(this.key(account, id, catalog));
    if (entry) this.remove(entry);
    this.revision++;
    this.notify();
  }
  private remove(entry: Entry) {
    clearTimeout(entry.timer);
    entry.controller.abort();
    if (entry.snapshot.url) URL.revokeObjectURL(entry.snapshot.url);
    if (this.entries.get(entry.key) === entry) this.entries.delete(entry.key);
  }
  private trim() {
    let bytes = [...this.entries.values()].reduce((sum, entry) => sum + entry.bytes, 0);
    const idle = [...this.entries.values()].filter((entry) => !entry.users)
      .sort((a, b) => a.used - b.used);
    for (const entry of idle) {
      if (bytes <= this.maxBytes && this.entries.size <= this.maxEntries) break;
      bytes -= entry.bytes;
      this.remove(entry);
    }
  }
}

export const mediaCache = new MediaCache();
