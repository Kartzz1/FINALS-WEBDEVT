import Icon from "./Icon.jsx";

const ICONS = { error: "alert", warning: "alert", success: "check", info: "info" };

// Errors use role="alert" so they are announced at once; the rest use the calmer role="status".
export default function Alert({ kind = "error", children }) {
  if (!children) {
    return null;
  }
  return (
    <div className={`alert alert-${kind}`} role={kind === "error" ? "alert" : "status"}>
      <Icon name={ICONS[kind]} size={18} />
      <div>{children}</div>
    </div>
  );
}
