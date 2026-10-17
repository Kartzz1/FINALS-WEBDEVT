import Button from "./Button.jsx";

// Says what went wrong in plain words and what the person can do next.
export default function ErrorState({ error, onRetry, notFoundText }) {
  const unreachable = error.status === 0 || error.status === 502 || error.status === 504;
  const databaseDown = error.status === 503;
  let message = error.message;
  if (unreachable) {
    message = "We could not reach the reservation server. Check that the backend is running, then try again.";
  } else if (databaseDown) {
    message = "The restaurant database is temporarily unavailable. Please try again in a moment.";
  } else if (error.status === 404 && notFoundText) {
    message = notFoundText;
  }

  return (
    <div className="error-state" role="alert">
      <h2>{unreachable || databaseDown ? "Connection problem" : "We could not load this"}</h2>
      <p>{message}</p>
      {onRetry && (
        <div className="actions">
          <Button onClick={onRetry}>Try again</Button>
        </div>
      )}
    </div>
  );
}
