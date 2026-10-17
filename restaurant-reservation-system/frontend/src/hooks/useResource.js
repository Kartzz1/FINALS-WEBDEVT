import { useCallback, useEffect, useState } from "react";

// Runs `fetcher` whenever `deps` change. Old data stays on screen while a
// reload is in flight, so lists do not flash empty after every action.
export function useResource(fetcher, deps) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((previous) => ({ ...previous, loading: true, error: null }));
    fetcher()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (!cancelled) setState({ data: null, loading: false, error });
      });
    return () => {
      cancelled = true;
    };
    // fetcher is recreated every render; the explicit deps decide when to reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);

  const reload = useCallback(() => setVersion((current) => current + 1), []);
  return { ...state, reload };
}
