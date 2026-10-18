/** Keep image downloads from competing with chat and account requests. */
export class MediaDownloadQueue {
  private active = 0;
  private waiting: Array<() => void> = [];
  constructor(private concurrency = 4) {}

  run<T>(signal: AbortSignal, load: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const cancel = () => {
        const index = this.waiting.indexOf(start);
        if (index >= 0) this.waiting.splice(index, 1);
        reject(new DOMException("Image request cancelled", "AbortError"));
      };
      const start = () => {
        signal.removeEventListener("abort", cancel);
        if (signal.aborted) { cancel(); return; }
        this.active++;
        void Promise.resolve().then(load).then(resolve, reject).finally(() => {
          this.active--;
          this.drain();
        });
      };
      if (signal.aborted) { cancel(); return; }
      signal.addEventListener("abort", cancel, { once: true });
      this.waiting.push(start);
      this.drain();
    });
  }

  private drain() {
    while (this.active < this.concurrency && this.waiting.length)
      this.waiting.shift()!();
  }
}

export const mediaDownloads = new MediaDownloadQueue();
