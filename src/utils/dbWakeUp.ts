// dbWakeUp.ts
// Lightweight singleton that coordinates the "database waking up" UX.
// The axios interceptor calls trigger() when a request fails because the
// SQL Server is sleeping (Azure SQL Serverless auto-pause). Subscribers
// (the overlay component) re-render when state changes.

type WakeState = 'idle' | 'waking' | 'failed';

interface Snapshot {
    state: WakeState;
    startedAt: number | null;
    attempts: number;
    lastError: string | null;
}

type Listener = (snap: Snapshot) => void;

const POLL_INTERVAL_MS = 3000;
const MAX_WAIT_MS = 5 * 60 * 1000; // 5 minutes — Azure SQL Serverless wake is usually < 90s

class DbWakeUpController {
    private snapshot: Snapshot = { state: 'idle', startedAt: null, attempts: 0, lastError: null };
    private listeners = new Set<Listener>();
    private waiters: Array<(ok: boolean) => void> = [];
    private pollTimer: ReturnType<typeof setTimeout> | null = null;

    getSnapshot(): Snapshot {
        return this.snapshot;
    }

    subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private emit() {
        for (const l of this.listeners) {
            try { l(this.snapshot); } catch { /* listener errors must not break polling */ }
        }
    }

    private setSnapshot(patch: Partial<Snapshot>) {
        this.snapshot = { ...this.snapshot, ...patch };
        this.emit();
    }

    /**
     * Returns a promise that resolves true when the DB is back up, or false
     * if we time out. Triggers polling on first call; subsequent callers
     * piggy-back on the same polling loop.
     */
    waitUntilReady(): Promise<boolean> {
        if (this.snapshot.state === 'idle') {
            // Already up — resolve immediately.
            return Promise.resolve(true);
        }
        return new Promise<boolean>((resolve) => {
            this.waiters.push(resolve);
        });
    }

    trigger(): Promise<boolean> {
        if (this.snapshot.state !== 'waking') {
            this.setSnapshot({
                state: 'waking',
                startedAt: Date.now(),
                attempts: 0,
                lastError: null
            });
            this.poll();
        }
        return this.waitUntilReady();
    }

    private async poll() {
        const startedAt = this.snapshot.startedAt ?? Date.now();
        const elapsed = Date.now() - startedAt;
        if (elapsed > MAX_WAIT_MS) {
            this.setSnapshot({ state: 'failed' });
            this.flushWaiters(false);
            return;
        }

        this.setSnapshot({ attempts: this.snapshot.attempts + 1 });

        try {
            const res = await fetch('/api/health/db', {
                method: 'GET',
                cache: 'no-store',
                headers: { Accept: 'application/json' }
            });
            if (res.ok) {
                this.setSnapshot({ state: 'idle', startedAt: null, lastError: null });
                this.flushWaiters(true);
                return;
            }
            // 503 — keep polling.
            this.setSnapshot({ lastError: `HTTP ${res.status}` });
        } catch (err: any) {
            this.setSnapshot({ lastError: err?.message || 'network error' });
        }

        this.pollTimer = setTimeout(() => this.poll(), POLL_INTERVAL_MS);
    }

    private flushWaiters(ok: boolean) {
        const waiters = this.waiters;
        this.waiters = [];
        for (const w of waiters) {
            try { w(ok); } catch { /* swallow */ }
        }
        if (this.pollTimer) {
            clearTimeout(this.pollTimer);
            this.pollTimer = null;
        }
    }

    /** Manual reset — used by the "Try again" button after a timeout. */
    retry() {
        if (this.snapshot.state === 'failed') {
            this.setSnapshot({ state: 'waking', startedAt: Date.now(), attempts: 0, lastError: null });
            this.poll();
        }
    }
}

const dbWakeUp = new DbWakeUpController();
export default dbWakeUp;
export type { Snapshot, WakeState };
