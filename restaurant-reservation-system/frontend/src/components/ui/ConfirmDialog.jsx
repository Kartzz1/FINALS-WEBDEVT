import Button from "./Button.jsx";
import Modal from "./Modal.jsx";

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Keep it",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal open={open} title={title} onClose={onCancel} busy={busy} size="sm">
      <p>{message}</p>
      <div className="actions actions-end">
        <Button onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={busy}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
