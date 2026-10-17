import { useEffect, useState } from "react";
import { useAction } from "../../hooks/useAction.js";
import { useResource } from "../../hooks/useResource.js";
import { catalogService } from "../../services/catalogService.js";
import Alert from "../ui/Alert.jsx";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import { useToast } from "../ui/Toast.jsx";

const POLL_MS = 2500;
const FAILURES_SHOWN = 10;
const STATUS = {
  running: { label: "Running", tone: "info" },
  completed: { label: "Completed", tone: "success" },
  completed_with_errors: { label: "Completed with errors", tone: "error" },
  failed: { label: "Failed", tone: "error" },
};

function StatusBadge({ status }) {
  const { label, tone } = STATUS[status] ?? { label: status, tone: "neutral" };
  return <span className={`badge badge-${tone}`}>{label}</span>;
}

// Starts an import on the server (the external service is only ever called from there)
// and follows its progress until it finishes.
export default function SyncPanel({ onFinished }) {
  const toast = useToast();
  const status = useResource(() => catalogService.syncStatus(), []);
  const { busy, error, run } = useAction();
  const [selected, setSelected] = useState(["lipa", "batangas"]);
  const [dryRun, setDryRun] = useState(false);
  const [watching, setWatching] = useState(null);

  const areas = status.data?.areas ?? [];
  const current = status.data?.run ?? null;
  const running = current?.status === "running";

  useEffect(() => {
    if (!running) return undefined;
    const timer = window.setInterval(status.reload, POLL_MS);
    return () => window.clearInterval(timer);
  }, [running, status.reload]);

  // Tell the administrator once when the import they started has finished.
  useEffect(() => {
    if (watching && current && current.id === watching && current.status !== "running") {
      setWatching(null);
      const { created, updated } = current.totals;
      if (current.status === "failed") toast.error("The import failed. See the details below.");
      else toast.success(`Import finished: ${created} new, ${updated} updated.`);
      onFinished?.();
    }
  }, [current, watching, toast, onFinished]);

  function toggle(key) {
    setSelected((list) => (list.includes(key) ? list.filter((item) => item !== key) : [...list, key]));
  }

  async function start() {
    const outcome = await run(() => catalogService.startSync({ areas: selected, dryRun }));
    if (outcome.ok) {
      setWatching(outcome.result.run.id);
      status.reload();
    }
  }

  return (
    <Card as="section" aria-labelledby="sync-heading" className="sync-panel">
      <h2 id="sync-heading">Import restaurants from OpenStreetMap</h2>
      <p className="muted">
        Loads real restaurants, cafes, bars, and pubs for the places below from OpenStreetMap, a public map database.
        Existing restaurants are updated, never duplicated, and anything you edited by hand is kept.
      </p>

      <Alert>{error}</Alert>
      {status.error && <Alert>{status.error.message}</Alert>}

      <fieldset className="sync-areas" disabled={running || busy}>
        <legend>Places to import</legend>
        {areas.map((area) => (
          <label key={area.key} className="check">
            <input type="checkbox" checked={selected.includes(area.key)} onChange={() => toggle(area.key)} />
            {area.city}
          </label>
        ))}
      </fieldset>
      <label className="check">
        <input type="checkbox" checked={dryRun} onChange={(event) => setDryRun(event.target.checked)} disabled={running || busy} />
        Preview only (show what would change, save nothing)
      </label>

      <div className="actions">
        <Button variant="primary" icon="refresh" loading={busy || running} disabled={selected.length === 0} onClick={start}>
          {running ? "Importing" : dryRun ? "Preview import" : "Start import"}
        </Button>
      </div>
      {running && <p className="hint">Importing. This can take a few minutes because the public service limits how fast it answers.</p>}

      {current && (
        <div className="sync-report" aria-live="polite">
          <h3>
            Latest import <StatusBadge status={current.status} />
            {current.dryRun && <span className="badge badge-neutral">Preview</span>}
          </h3>
          {current.error && <Alert>{current.error}</Alert>}
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Place</th>
                  <th scope="col">Status</th>
                  <th scope="col">Found</th>
                  <th scope="col">New</th>
                  <th scope="col">Updated</th>
                  <th scope="col">Unchanged</th>
                  <th scope="col">Duplicates</th>
                  <th scope="col">Failed</th>
                </tr>
              </thead>
              <tbody>
                {current.areas.map((area) => (
                  <tr key={area.key}>
                    <td data-label="Place">
                      {area.city}
                      {area.error && <div className="field-error">{area.error}</div>}
                    </td>
                    <td data-label="Status">
                      <StatusBadge status={area.status} />
                    </td>
                    <td data-label="Found">{area.fetched}</td>
                    <td data-label="New">{area.created}</td>
                    <td data-label="Updated">{area.updated}</td>
                    <td data-label="Unchanged">{area.unchanged}</td>
                    <td data-label="Duplicates">{area.duplicates}</td>
                    <td data-label="Failed">{area.failed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {current.failures.length > 0 && (
            <details className="sync-failures">
              <summary>
                {current.failures.length} record{current.failures.length === 1 ? "" : "s"} could not be saved
              </summary>
              <ul>
                {current.failures.slice(0, FAILURES_SHOWN).map((failure) => (
                  <li key={failure.externalPlaceId}>
                    <strong>{failure.name}</strong>: {failure.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      <p className="attribution">
        Restaurant data ©{" "}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
          OpenStreetMap contributors
        </a>
        , available under the Open Database License.
      </p>
    </Card>
  );
}
