import Button from "./Button.jsx";

export default function Pagination({ page, totalPages, onChange }) {
  if (!totalPages || totalPages <= 1) {
    return null;
  }
  return (
    <nav className="pagination" aria-label="Pagination">
      <Button size="sm" icon="chevron-left" onClick={() => onChange(page - 1)} disabled={page <= 1}>
        Previous
      </Button>
      <span>
        Page {page} of {totalPages}
      </span>
      <Button size="sm" onClick={() => onChange(page + 1)} disabled={page >= totalPages}>
        Next
      </Button>
    </nav>
  );
}
