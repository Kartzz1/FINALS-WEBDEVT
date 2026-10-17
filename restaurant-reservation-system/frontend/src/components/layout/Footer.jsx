import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import Logo from "./Logo.jsx";

export default function Footer() {
  const { user } = useAuth();

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link to="/" className="brand" aria-label="Restaurant Reservation System, home">
              <span className="brand-mark">
                <Logo size={32} />
              </span>
              <span className="brand-text">Restaurant Reservation System</span>
            </Link>
            <p>Find an open table, reserve it in seconds, and change your plans without a phone call.</p>
          </div>
          <nav className="footer-links" aria-label="Explore">
            <h2>Explore</h2>
            <ul>
              <li>
                <Link to="/restaurants">Restaurants</Link>
              </li>
              <li>
                <Link to={{ pathname: "/", hash: "#how" }}>How it works</Link>
              </li>
            </ul>
          </nav>
          <nav className="footer-links" aria-label="Account">
            <h2>Account</h2>
            <ul>
              {user ? (
                <>
                  <li>
                    <Link to="/reservations">My reservations</Link>
                  </li>
                  <li>
                    <Link to="/profile">Profile</Link>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <Link to="/login">Log in</Link>
                  </li>
                  <li>
                    <Link to="/register">Create account</Link>
                  </li>
                </>
              )}
            </ul>
          </nav>
        </div>
        <p className="footer-legal">© {new Date().getFullYear()} Restaurant Reservation System. All rights reserved.</p>
      </div>
    </footer>
  );
}
