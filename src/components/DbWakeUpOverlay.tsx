import { useEffect, useState } from 'react';
import { FaSpinner } from 'react-icons/fa';
import dbWakeUp, { type Snapshot } from '../utils/dbWakeUp';

function formatElapsed(ms: number): string {
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}m ${r}s`;
}

export default function DbWakeUpOverlay() {
    const [snap, setSnap] = useState<Snapshot>(dbWakeUp.getSnapshot());
    const [now, setNow] = useState<number>(Date.now());

    useEffect(() => dbWakeUp.subscribe(setSnap), []);

    useEffect(() => {
        if (snap.state !== 'waking') return;
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, [snap.state]);

    if (snap.state === 'idle') return null;

    const elapsed = snap.startedAt ? now - snap.startedAt : 0;
    const lingering = elapsed > 60_000;
    const failed = snap.state === 'failed';

    return (
        <div
            role="status"
            aria-live="polite"
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
        >
            <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4 text-center">
                <div className="flex items-center justify-center gap-3 mb-4">
                    <img src="/images/GuardianLogo.svg" alt="" className="w-8 h-8" />
                    <span className="text-h5 font-display font-bold text-black">Guardian</span>
                </div>

                {!failed ? (
                    <>
                        <FaSpinner
                            className="animate-spin mx-auto text-secondary"
                            size={36}
                            aria-hidden="true"
                            style={{ color: '#2EBCBC' }}
                        />
                        <h2 className="text-lg font-semibold mt-4 mb-2 text-gray-900">
                            Waking up your secure database…
                        </h2>
                        <p className="text-sm text-gray-600 leading-relaxed">
                            We pause the database when it's idle to keep things secure and efficient.
                            Resuming usually takes <strong>30–60 seconds</strong>. We'll continue
                            automatically as soon as it's ready.
                        </p>
                        <div className="mt-4 text-xs text-gray-400">
                            Elapsed: {formatElapsed(elapsed)}
                            {snap.attempts > 0 && <> · Check #{snap.attempts}</>}
                        </div>
                        {lingering && (
                            <p className="mt-3 text-xs text-gray-500 italic">
                                This is taking longer than usual — still trying. You can leave this
                                page open; we'll pick up where you left off.
                            </p>
                        )}
                    </>
                ) : (
                    <>
                        <div className="text-red-500 text-3xl mb-3" aria-hidden="true">⚠</div>
                        <h2 className="text-lg font-semibold mb-2 text-gray-900">
                            We couldn't reach the database
                        </h2>
                        <p className="text-sm text-gray-600 leading-relaxed">
                            The database is taking longer than expected to wake up. Please check
                            your connection and try again. If this keeps happening, contact support.
                        </p>
                        <button
                            type="button"
                            onClick={() => dbWakeUp.retry()}
                            className="mt-5 w-full py-3 px-4 rounded-lg text-white font-medium transition-colors duration-300"
                            style={{ background: '#2EBCBC' }}
                        >
                            Try again
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
