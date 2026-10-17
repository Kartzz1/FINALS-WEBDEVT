import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import Button, { ButtonLink } from "../ui/Button.jsx";
import Icon from "../ui/Icon.jsx";
import ThemeToggle from "../ui/ThemeToggle.jsx";
import Logo from "./Logo.jsx";

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toggleRef = useRef(null);
  const navRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Opening the menu moves focus to its first link; Escape closes it and gives
  // focus back to the button that opened it.
  useEffect(() => {
    if (!menuOpen) return undefined;
    navRef.current?.querySelector("a, button")?.focus();
    function onKeyDown(event) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        toggleRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  async function handleLogout() {
    setLoggingOut(true);
    await logout();
    setLoggingOut(false);
    navigate("/", { replace: true });
  }

  return (
    <header className="site-header">
      <div className="container header-row">
        <Link to="/" className="brand" aria-label="Restaurant Reservation System, home">
          <span className="brand-mark">
            <Logo />
          </span>
          <span className="brand-text">Restaurant Reservation System</span>
        </Link>

        <nav ref={navRef} id="site-nav" className="nav" data-open={menuOpen} aria-label="Main">
          <ul className="nav-links">
            {user ? (
              <>
                <li>
                  <NavLink to="/restaurants">Restaurants</NavLink>
                </li>
                <li>
                  <NavLink to="/reservations">My reservations</NavLink>
                </li>
                <li>
                  <NavLink to="/profile">Profile</NavLink>
                </li>
                {user.role === "admin" && (
                  <li>
                    <NavLink to="/admin">Administration</NavLink>
                  </li>
                )}
              </>
            ) : (
              <>
                <li>
                  <Link to={{ pathname: "/", hash: "#how" }}>How it works</Link>
                </li>
                <li>
                  <NavLink to="/restaurants">Restaurants</NavLink>
                </li>
              </>
            )}
          </ul>
          <div className="nav-actions">
            {user ? (
              <Button size="sm" icon="logout" onClick={handleLogout} loading={loggingOut}>
                Log out
              </Button>
            ) : (
              <ButtonLink to="/login" size="sm">
                Log in
              </ButtonLink>
            )}
            <ButtonLink to="/restaurants" variant="primary" size="sm">
              Reserve a table
            </ButtonLink>
          </div>
        </nav>

        <div className="header-tools">
          <ThemeToggle />
          <button
            ref={toggleRef}
            type="button"
            className="btn btn-icon nav-toggle"
            aria-expanded={menuOpen}
            aria-controls="site-nav"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Icon name={menuOpen ? "close" : "menu"} size={22} />
          </button>
        </div>
      </div>
    </header>
  );
}
