import { Link } from "react-router-dom";
import Icon from "./Icon.jsx";
import Spinner from "./Spinner.jsx";

function classNames({ variant, size, block }) {
  return ["btn", variant !== "secondary" && `btn-${variant}`, size !== "md" && `btn-${size}`, block && "btn-block"]
    .filter(Boolean)
    .join(" ");
}

// variant: primary | secondary | danger | ghost    size: sm | md | lg
// `loading` shows a spinner, disables the button, and tells assistive technology it is busy.
export default function Button({
  variant = "secondary",
  size = "md",
  block = false,
  loading = false,
  icon,
  type = "button",
  disabled,
  children,
  ...props
}) {
  return (
    <button
      type={type}
      className={classNames({ variant, size, block })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner /> : icon && <Icon name={icon} size={18} />}
      <span>{children}</span>
    </button>
  );
}

export function ButtonLink({ variant = "secondary", size = "md", block = false, icon, children, ...props }) {
  return (
    <Link className={classNames({ variant, size, block })} {...props}>
      {icon && <Icon name={icon} size={18} />}
      <span>{children}</span>
    </Link>
  );
}
