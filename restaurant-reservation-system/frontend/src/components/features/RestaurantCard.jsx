import { useState } from "react";
import { Link } from "react-router-dom";
import { describeTables, formatLocation } from "../../utils/restaurant.js";
import { ButtonLink } from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import Icon from "../ui/Icon.jsx";

// Shown only when a rating exists. Ratings are never made up; most imported restaurants have none.
export function RatingLine({ rating, reviewCount }) {
  if (typeof rating !== "number") {
    return <span className="muted">No ratings yet</span>;
  }
  return (
    <span className="rating">
      <Icon name="star" size={16} />
      <strong>{rating.toFixed(1)}</strong>
      <span className="visually-hidden"> out of 5</span>
      {reviewCount ? <span className="muted"> ({reviewCount.toLocaleString()})</span> : null}
    </span>
  );
}

export default function RestaurantCard({ restaurant }) {
  const [imageFailed, setImageFailed] = useState(false);
  const location = formatLocation(restaurant);
  const labels = [restaurant.category, ...restaurant.cuisine].filter(Boolean).slice(0, 4);
  const hasTables = restaurant.availableTables > 0;
  const link = `/restaurants/${restaurant.id}`;

  return (
    <Card as="li" className="restaurant-card">
      <Link className="restaurant-media" to={link} tabIndex={-1} aria-hidden="true">
        {restaurant.image && !imageFailed ? (
          <img src={restaurant.image} alt="" loading="lazy" onError={() => setImageFailed(true)} />
        ) : (
          <span className="monogram">{restaurant.name.charAt(0).toUpperCase()}</span>
        )}
      </Link>
      <div className="restaurant-body">
        <h3 className="restaurant-name">
          <Link to={link}>{restaurant.name}</Link>
        </h3>
        {location && (
          <p className="address">
            <Icon name="pin" size={16} />
            <span>{location}</span>
          </p>
        )}
        {labels.length > 0 && (
          <ul className="chips" aria-label="Category and cuisine">
            {labels.map((label) => (
              <li key={label} className="chip">
                {label}
              </li>
            ))}
          </ul>
        )}
        <p className="restaurant-meta">
          <RatingLine rating={restaurant.rating} reviewCount={restaurant.reviewCount} />
          {restaurant.priceRange && (
            <span className="price" aria-label={`Price range ${restaurant.priceRange}`}>
              {restaurant.priceRange}
            </span>
          )}
        </p>
        <p className={hasTables ? "tables-note" : "tables-note tables-note-empty"}>
          {describeTables(restaurant.tableSummary)}
        </p>
        <ButtonLink to={link} variant="primary" size="sm">
          {hasTables ? "View and reserve" : "View details"}
        </ButtonLink>
      </div>
    </Card>
  );
}
