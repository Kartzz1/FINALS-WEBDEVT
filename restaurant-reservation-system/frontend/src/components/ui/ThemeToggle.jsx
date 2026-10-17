import { useTheme } from "../../context/ThemeContext.jsx";
import Icon from "./Icon.jsx";

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  const label = dark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button type="button" className="btn btn-icon" onClick={toggle} aria-label={label} title={label}>
      <Icon name={dark ? "sun" : "moon"} size={20} />
    </button>
  );
}
