import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Footer from "../components/layout/Footer.jsx";
import Header from "../components/layout/Header.jsx";
import ServerBanner from "../components/layout/ServerBanner.jsx";

export default function MainLayout() {
  const location = useLocation();
  const mainRef = useRef(null);

  // After navigating, move focus to the page content so keyboard and screen
  // reader users start at the top of the new page, not in the old navigation.
  useEffect(() => {
    mainRef.current?.focus();
  }, [location.pathname]);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header />
      <ServerBanner />
      <main id="main" tabIndex={-1} ref={mainRef} className="container main">
        <div key={location.pathname} className="page">
          <Outlet />
        </div>
      </main>
      <Footer />
    </>
  );
}
