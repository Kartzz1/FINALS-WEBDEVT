// An input, textarea, or select (via `as`) with its label, optional hint, and
// error message. The hint and error are tied to the control with aria-describedby.
export default function FormField({
  id,
  label,
  error,
  hint,
  optional = false,
  as: Control = "input",
  children,
  ...props
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {props.required && (
          <span className="required" aria-hidden="true">
            {" "}
            *
          </span>
        )}
        {optional && <span className="optional"> (optional)</span>}
      </label>
      <Control id={id} aria-invalid={error ? "true" : undefined} aria-describedby={describedBy} {...props}>
        {children}
      </Control>
      {hint && (
        <p id={hintId} className="hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
