// Skeleton placeholders shaped like the content that is loading, so the page
// does not jump when data arrives. They fade gently in and out instead of sliding a shimmer.
function Bar({ height = "1rem", width = "100%" }) {
  return <span className="skeleton" style={{ height, width }} aria-hidden="true" />;
}

function CardSkeletons({ count }) {
  return (
    <ul className="card-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="card">
          <Bar height="1.25rem" width="60%" />
          <Bar width="85%" />
          <Bar height="2.5rem" width="7rem" />
        </li>
      ))}
    </ul>
  );
}

function ListSkeleton({ count }) {
  return (
    <div className="skeleton-stack" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <Bar key={index} height="3.25rem" />
      ))}
    </div>
  );
}

// variant: cards | list | page
export default function Loading({ label = "Loading", variant = "list" }) {
  return (
    <div role="status" aria-live="polite">
      {variant === "cards" && <CardSkeletons count={6} />}
      {variant === "list" && <ListSkeleton count={5} />}
      {variant === "page" && (
        <div className="skeleton-stack" aria-hidden="true">
          <Bar height="2rem" width="45%" />
          <Bar width="30%" />
          <Bar height="9rem" />
        </div>
      )}
      <span className="visually-hidden">{label}…</span>
    </div>
  );
}
