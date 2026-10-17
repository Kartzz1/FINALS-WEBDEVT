import { useCallback, useState } from "react";
import { useToast } from "../components/ui/Toast.jsx";

// Wraps an async action so pages get busy/error state without repeating try/catch.
// A success message appears as a toast; a failure stays inline so it is not missed.
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = useCallback(
    async (action, successMessage = "") => {
      setBusy(true);
      setError("");
      try {
        const result = await action();
        if (successMessage) toast.success(successMessage);
        return { ok: true, result };
      } catch (err) {
        setError(err.message);
        return { ok: false, error: err };
      } finally {
        setBusy(false);
      }
    },
    [toast]
  );

  return { busy, error, run, setError };
}
