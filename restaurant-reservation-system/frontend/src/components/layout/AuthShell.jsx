import Icon from "../ui/Icon.jsx";
import Logo from "./Logo.jsx";

const POINTS = [
  "Live availability at every restaurant",
  "Instant confirmation, no phone calls",
  "Change or cancel before it starts",
];

// Sign-in and registration frame: a dark brand panel beside the form on wide
// screens, and just the form on phones so the task stays in front.
export default function AuthShell({ title, subtitle, footer, children }) {
  return (
    <div className="auth-shell">
      <aside className="auth-aside">
        <div className="brand-line">
          <span className="brand-mark">
            <Logo size={36} />
          </span>
          <span>Restaurant Reservation System</span>
        </div>
        <div>
          <h2>Your table, held the moment you book.</h2>
          <ul className="auth-points">
            {POINTS.map((point) => (
              <li key={point}>
                <Icon name="check" size={18} />
                {point}
              </li>
            ))}
          </ul>
        </div>
      </aside>
      <div className="auth-main">
        <h1>{title}</h1>
        <p className="muted">{subtitle}</p>
        {children}
        {footer && <p className="auth-switch">{footer}</p>}
      </div>
    </div>
  );
}
