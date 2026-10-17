export default function EmptyState({ title, children, action }) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action && <div className="actions">{action}</div>}
    </div>
  );
}
