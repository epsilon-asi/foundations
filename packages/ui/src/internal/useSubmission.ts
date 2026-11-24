import * as React from 'react';
/** Serialize activation and ignore a settled request after resolution or unmount. */
export function useSubmission(resolved: unknown) {
  const [pending, setPending] = React.useState<string>(),
    [error, setError] = React.useState('');
  const version = React.useRef(0),
    locked = React.useRef(false);
  React.useLayoutEffect(() => {
    locked.current = false;
    setPending(undefined);
    setError('');
    return () => {
      version.current++;
    };
  }, [resolved]);
  const run = async (id: string, perform: () => void | Promise<void>) => {
    if (locked.current || resolved) return;
    const ticket = version.current;
    locked.current = true;
    setPending(id);
    setError('');
    try {
      await perform();
    } catch (e) {
      if (ticket === version.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (ticket === version.current) {
        locked.current = false;
        setPending(undefined);
      }
    }
  };
  return { pending, error, run };
}
