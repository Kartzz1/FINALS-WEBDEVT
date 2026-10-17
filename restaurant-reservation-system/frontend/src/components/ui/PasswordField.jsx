import { useState } from "react";
import { PASSWORD_RULES } from "../../utils/validation.js";
import Icon from "./Icon.jsx";

// A password input with a show/hide button and, for new passwords, a live
// checklist of the rules so nobody has to guess why a password was refused.
export default function PasswordField({ id, label, error, hint, showRules = false, value, ...props }) {
  const [visible, setVisible] = useState(false);
  const hintId = hint ? `${id}-hint` : undefined;
  const rulesId = showRules ? `${id}-rules` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, rulesId, errorId].filter(Boolean).join(" ") || undefined;

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
      </label>
      <div className="password-wrap">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy}
          {...props}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible((current) => !current)}
          aria-pressed={visible}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          <Icon name={visible ? "eye-off" : "eye"} size={16} />
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {hint && (
        <p id={hintId} className="hint">
          {hint}
        </p>
      )}
      {showRules && (
        <ul id={rulesId} className="rules" aria-label="Password requirements">
          {PASSWORD_RULES.map((rule) => {
            const met = rule.test(value);
            return (
              <li key={rule.id} className={met ? "rule-met" : ""}>
                <Icon name={met ? "check" : "circle"} size={14} />
                {rule.label}
                <span className="visually-hidden">{met ? " (met)" : " (not met yet)"}</span>
              </li>
            );
          })}
        </ul>
      )}
      {error && (
        <p id={errorId} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
