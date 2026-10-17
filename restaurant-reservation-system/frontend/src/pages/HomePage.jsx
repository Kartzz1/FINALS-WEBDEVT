import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import PlateIllustration from "../components/features/PlateIllustration.jsx";
import RestaurantSection from "../components/features/RestaurantSection.jsx";
import { ButtonLink } from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import Icon from "../components/ui/Icon.jsx";
import { BRAND } from "../config/brand.js";
import { useAuth } from "../context/AuthContext.jsx";
import { usePageTitle } from "../hooks/usePageTitle.js";
import { useResource } from "../hooks/useResource.js";
import { catalogService } from "../services/catalogService.js";

// These are facts about how the system works, not customer statistics.
const HIGHLIGHTS = [
  { value: "Instant", label: "confirmation" },
  { value: "Zero", label: "double bookings" },
  { value: "24/7", label: "online booking" },
];

const STEPS = [
  { title: "Search", text: "Pick a restaurant, a date and time, your party size, and how long you will stay." },
  { title: "Choose a table", text: "See every table that fits your party and is free for the whole visit." },
  { title: "Enjoy your evening", text: "Your table is confirmed at once. Change or cancel from your reservations page." },
];

const CUISINES_SHOWN = 12;

export default function HomePage() {
  const { user } = useAuth();
  const { hash } = useLocation();
  const facets = useResource(() => catalogService.facets(), []);
  usePageTitle("");
  const firstName = user?.name.split(" ")[0];

  // Links such as /#how scroll to their section once the page is shown.
  useEffect(() => {
    if (!hash) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document
      .getElementById(hash.slice(1))
      ?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }, [hash]);

  const loaded = facets.data?.facets;
  const empty = loaded && loaded.cities.length === 0;
  const cuisines = loaded?.cuisines.slice(0, CUISINES_SHOWN) ?? [];

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div>
          <p className="eyebrow">Restaurant Reservation System</p>
          <h1 id="hero-title">{user ? `Welcome back, ${firstName}.` : "Reserve the table you deserve, in seconds."}</h1>
          <p className="lead">
            {user
              ? "Find a free table or manage your upcoming reservations."
              : "Discover real restaurants in Lipa City, Batangas City, and nearby, check live availability, and secure your table with instant confirmation."}
          </p>
          <div className="actions">
            {user ? (
              <>
                <ButtonLink to="/restaurants" variant="primary" size="lg">
                  Find a table
                </ButtonLink>
                <ButtonLink to="/reservations" size="lg">
                  My reservations
                </ButtonLink>
              </>
            ) : (
              <>
                <ButtonLink to="/restaurants" variant="primary" size="lg">
                  Browse restaurants
                </ButtonLink>
                <ButtonLink to={{ pathname: "/", hash: "#how" }} size="lg">
                  How it works
                </ButtonLink>
              </>
            )}
          </div>
          <ul className="highlights">
            {HIGHLIGHTS.map((item) => (
              <li key={item.value} className="highlight">
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="hero-visual">
          {BRAND.heroImage ? (
            <img className="hero-photo" src={BRAND.heroImage} alt={BRAND.heroImageAlt} />
          ) : (
            <PlateIllustration />
          )}
          <div className="hero-badge">
            <Icon name="check" size={22} />
            <div>
              <strong>Instant confirmation</strong>
              <span>Your table is held the moment you book.</span>
            </div>
          </div>
        </div>
      </section>

      {empty && (
        <Card as="section" className="notice" aria-labelledby="empty-heading">
          <h2 id="empty-heading">No restaurants have been added yet</h2>
          <p className="muted">
            {user?.role === "admin"
              ? "Import real restaurants from OpenStreetMap, or add one by hand, in Administration."
              : "Restaurants will appear here soon. Please check back shortly."}
          </p>
          {user?.role === "admin" && (
            <ButtonLink to="/admin/restaurants" variant="primary">
              Open restaurant administration
            </ButtonLink>
          )}
        </Card>
      )}

      {!empty && (
        <>
          <RestaurantSection
            id="featured"
            title="Popular restaurants"
            altTitle="Featured restaurants"
            subtitle="Listings with the most complete information."
            params={{ sort: "featured" }}
            limit={6}
            seeAllTo="/restaurants"
          />
          <RestaurantSection
            id="lipa"
            title="Restaurants in Lipa City"
            params={{ city: "Lipa City", sort: "featured" }}
            seeAllTo="/restaurants?city=Lipa%20City"
          />
          <RestaurantSection
            id="batangas"
            title="Restaurants in Batangas City"
            params={{ city: "Batangas City", sort: "featured" }}
            seeAllTo="/restaurants?city=Batangas%20City"
          />
        </>
      )}

      {cuisines.length > 0 && (
        <section className="section" aria-labelledby="cuisine-heading">
          <h2 id="cuisine-heading" className="section-title">
            Browse by cuisine
          </h2>
          <ul className="cuisine-grid">
            {cuisines.map((cuisine) => (
              <li key={cuisine.name}>
                <Link to={`/restaurants?cuisine=${encodeURIComponent(cuisine.name)}`} className="cuisine-link">
                  <span>{cuisine.name}</span>
                  <small>{cuisine.count}</small>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section id="how" className="section" aria-labelledby="how-heading">
        <h2 id="how-heading" className="section-title">
          How it works
        </h2>
        <ol className="steps">
          {STEPS.map((step) => (
            <li key={step.title}>
              <strong>{step.title}</strong>
              <span>{step.text}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="cta-band" aria-labelledby="cta-heading">
        <div>
          <h2 id="cta-heading">{user ? "Ready for your next meal out?" : "Your table is waiting."}</h2>
          <p>{user ? "Browse the restaurants and book in a few taps." : "Create a free account and reserve in under a minute."}</p>
        </div>
        <ButtonLink to={user ? "/restaurants" : "/register"} variant="gold" size="lg">
          {user ? "Find a table" : "Create your account"}
        </ButtonLink>
      </section>
    </>
  );
}
