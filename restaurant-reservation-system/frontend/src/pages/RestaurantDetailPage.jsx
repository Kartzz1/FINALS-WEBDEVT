import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import OpeningHours from "../components/features/OpeningHours.jsx";
import { RatingLine } from "../components/features/RestaurantCard.jsx";
import RestaurantMap from "../components/features/RestaurantMap.jsx";
import Alert from "../components/ui/Alert.jsx";
import Badge from "../components/ui/Badge.jsx";
import { ButtonLink } from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import Icon from "../components/ui/Icon.jsx";
import Loading from "../components/ui/Loading.jsx";
import { usePageTitle } from "../hooks/usePageTitle.js";
import { useResource } from "../hooks/useResource.js";
import { catalogService } from "../services/catalogService.js";
import { describeTables, directionsUrl, formatLocation, phoneLink } from "../utils/restaurant.js";

export default function RestaurantDetailPage() {
  const { id } = useParams();
  const [imageFailed, setImageFailed] = useState(false);
  const { data, loading, error, reload } = useResource(() => catalogService.getRestaurant(id), [id]);
  const restaurant = data?.restaurant;
  usePageTitle(restaurant?.name ?? "Restaurant");

  if (loading && !restaurant) {
    return <Loading label="Loading restaurant" variant="page" />;
  }
  if (error) {
    return (
      <>
        <ErrorState error={error} onRetry={reload} notFoundText="That restaurant could not be found, or it is no longer listed." />
        <p className="auth-switch">
          <Link to="/restaurants">Back to all restaurants</Link>
        </p>
      </>
    );
  }

  const location = formatLocation(restaurant);
  const labels = [restaurant.category, ...restaurant.cuisine].filter(Boolean);
  const hasTables = restaurant.availableTables > 0;
  const hasCoordinates = restaurant.latitude != null && restaurant.longitude != null;
  const hasContact = restaurant.phone || restaurant.email || restaurant.website;
  const openStreetMapSource = restaurant.source?.provider === "openstreetmap";

  return (
    <>
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/restaurants">Restaurants</Link>
        <Icon name="chevron-right" size={16} />
        <span aria-current="page">{restaurant.name}</span>
      </nav>

      <header className="detail-hero">
        <div className="detail-banner">
          {restaurant.image && !imageFailed ? (
            <img src={restaurant.image} alt={`${restaurant.name}`} onError={() => setImageFailed(true)} />
          ) : (
            <span className="monogram monogram-lg" aria-hidden="true">
              {restaurant.name.charAt(0).toUpperCase()}
            </span>
          )}
          {restaurant.image && !imageFailed && restaurant.imageCredit && (
            <small className="image-credit">{restaurant.imageCredit}</small>
          )}
        </div>
        <div className="detail-title">
          <h1>{restaurant.name}</h1>
          {labels.length > 0 && (
            <ul className="chips" aria-label="Category and cuisine">
              {labels.map((label) => (
                <li key={label} className="chip">
                  {label}
                </li>
              ))}
            </ul>
          )}
          {location && (
            <p className="page-subtitle">
              <Icon name="pin" size={18} />
              {location}
            </p>
          )}
          <p className="restaurant-meta">
            <RatingLine rating={restaurant.rating} reviewCount={restaurant.reviewCount} />
            {restaurant.priceRange && (
              <span className="price" aria-label={`Price range ${restaurant.priceRange}`}>
                {restaurant.priceRange}
              </span>
            )}
            {restaurant.status === "inactive" && <Badge status="inactive" />}
          </p>
        </div>
      </header>

      <div className="detail-grid">
        <div className="detail-main">
          <section className="detail-section" aria-labelledby="about-heading">
            <h2 id="about-heading">About</h2>
            {restaurant.description ? (
              <p>{restaurant.description}</p>
            ) : (
              <p className="muted">No description has been added for this restaurant yet.</p>
            )}
          </section>

          {restaurant.amenities.length > 0 && (
            <section className="detail-section" aria-labelledby="amenities-heading">
              <h2 id="amenities-heading">Amenities</h2>
              <ul className="chips">
                {restaurant.amenities.map((amenity) => (
                  <li key={amenity} className="chip">
                    {amenity}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="detail-section" aria-labelledby="hours-heading">
            <h2 id="hours-heading">Opening hours</h2>
            {restaurant.openingHours ? (
              <OpeningHours text={restaurant.openingHours} />
            ) : (
              <p className="muted">Opening hours are not listed yet. Please contact the restaurant before you visit.</p>
            )}
          </section>

          <section className="detail-section" aria-labelledby="location-heading">
            <h2 id="location-heading">Location</h2>
            {restaurant.address ? <p>{restaurant.address}</p> : location && <p>{location}</p>}
            {hasCoordinates ? (
              <>
                <RestaurantMap latitude={restaurant.latitude} longitude={restaurant.longitude} name={restaurant.name} />
                <p>
                  <a href={directionsUrl(restaurant.latitude, restaurant.longitude)} target="_blank" rel="noopener noreferrer">
                    Get directions <Icon name="external" size={14} />
                  </a>
                </p>
              </>
            ) : (
              <p className="muted">A map location is not available for this restaurant yet.</p>
            )}
          </section>
        </div>

        <aside className="detail-aside">
          <Card raised as="section" aria-labelledby="reserve-heading">
            <h2 id="reserve-heading">Reserve a table</h2>
            <p className={hasTables ? "tables-note" : "tables-note tables-note-empty"}>{describeTables(restaurant.tableSummary)}</p>
            {hasTables ? (
              <ButtonLink to={`/restaurants/${restaurant.id}/reserve`} variant="primary" size="lg" block>
                Reserve a table
              </ButtonLink>
            ) : (
              <Alert kind="info">
                This restaurant has not opened tables for online booking yet. Please contact them directly.
              </Alert>
            )}
          </Card>

          <Card as="section" aria-labelledby="contact-heading">
            <h2 id="contact-heading">Contact</h2>
            {hasContact ? (
              <ul className="contact-list">
                {restaurant.phone && (
                  <li>
                    <Icon name="phone" size={18} />
                    {phoneLink(restaurant.phone) ? <a href={phoneLink(restaurant.phone)}>{restaurant.phone}</a> : restaurant.phone}
                  </li>
                )}
                {restaurant.email && (
                  <li>
                    <Icon name="mail" size={18} />
                    <a href={`mailto:${restaurant.email}`}>{restaurant.email}</a>
                  </li>
                )}
                {restaurant.website && (
                  <li>
                    <Icon name="globe" size={18} />
                    <a href={restaurant.website} target="_blank" rel="noopener noreferrer">
                      {new URL(restaurant.website).hostname.replace(/^www\./, "")}
                    </a>
                  </li>
                )}
              </ul>
            ) : (
              <p className="muted">No contact details are listed for this restaurant yet.</p>
            )}
          </Card>

          {openStreetMapSource && (
            <p className="attribution">
              Listing data ©{" "}
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
                OpenStreetMap contributors
              </a>{" "}
              (ODbL).{" "}
              {restaurant.source.url && (
                <a href={restaurant.source.url} target="_blank" rel="noopener noreferrer">
                  View on OpenStreetMap
                </a>
              )}
            </p>
          )}
        </aside>
      </div>
    </>
  );
}
