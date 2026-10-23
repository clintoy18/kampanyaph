import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api } from '../../app/api';
import type { ApiRequestPath } from '../../app/api-contract';

export function useResource<T>(path: ApiRequestPath | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    if (!path) {
      setData(null);
      setError('');
      setLoading(false);
      return;
    }
    setError('');
    try {
      setData(await api<T>(path));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load this section');
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { data, error, loading, refresh };
}

export function useAction(after?: () => Promise<unknown> | void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function run<T>(action: () => Promise<T>, message: string): Promise<T | undefined> {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await action();
      await after?.();
      setNotice(message);
      return result;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save changes');
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, notice, run, clearNotice: () => setNotice('') };
}

export function Feedback({ error, notice }: { error?: string; notice?: string }) {
  return (
    <>
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="alert success" role="status">
          {notice}
        </p>
      )}
    </>
  );
}
export function SectionTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="subtle">{description}</p>
      </div>
      {action}
    </header>
  );
}
export function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-rule" aria-hidden="true" />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function Status({ value }: { value: string }) {
  return (
    <span className={`status status-${value.toLowerCase()}`}>
      {value.replaceAll('_', ' ').toLowerCase()}
    </span>
  );
}
export function Loading() {
  return (
    <p className="loading-line" role="status">
      Loading workspace details…
    </p>
  );
}
