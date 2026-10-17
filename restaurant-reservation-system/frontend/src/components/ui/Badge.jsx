const TONES = {
  confirmed: "success",
  active: "success",
  cancelled: "error",
  inactive: "neutral",
  completed: "neutral",
  admin: "info",
  user: "neutral",
};
const LABELS = { user: "Customer", admin: "Administrator" };

// The label is always text, so colour never carries the meaning on its own.
export default function Badge({ status }) {
  const label = LABELS[status] ?? status.charAt(0).toUpperCase() + status.slice(1);
  return <span className={`badge badge-${TONES[status] ?? "neutral"}`}>{label}</span>;
}
