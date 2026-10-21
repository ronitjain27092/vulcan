import { useCallback, useEffect, useState } from 'react';

export async function getJSON<T>(path: string): Promise<T> {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${path} returned ${r.status}`);
  return r.json() as Promise<T>;
}
export async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${path} returned ${r.status}`);
  return r.json() as Promise<T>;
}
export type Remote<T> = { state: 'loading' } | { state: 'error'; message: string; retry: () => void } | { state: 'ready'; data: T };

export function useApi<T>(path: string | null): Remote<T> {
  const [res, setRes] = useState<Remote<T>>({ state: 'loading' });
  const [tick, setTick] = useState(0);
  const retry = useCallback(() => setTick(t => t + 1), []);
  useEffect(() => {
    if (path === null) return;
    let live = true;
    setRes({ state: 'loading' });
    getJSON<T>(path).then(d => live && setRes({ state: 'ready', data: d }), e => live && setRes({ state: 'error', message: String(e.message ?? e), retry }));
    return () => { live = false; };
  }, [path, tick, retry]);
  return res;
}
