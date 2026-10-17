import { Link } from "react-router-dom";
import { useResource } from "../../hooks/useResource.js";
import { catalogService } from "../../services/catalogService.js";
import ErrorState from "../ui/ErrorState.jsx";
import Loading from "../ui/Loading.jsx";
import RestaurantCard from "./RestaurantCard.jsx";

// A home page row of restaurants loaded from the API. It hides itself when the database
// has nothing for it, and shows a clear message if the request fails.
export default function RestaurantSection({ id, title, altTitle, subtitle, params, seeAllTo, limit = 4 }) {
  const { data, loading, error, reload } = useResource(
    () => catalogService.searchRestaurants({ ...params, limit }),
    [JSON.stringify(params), limit]
  );

  if (!error && data && data.items.length === 0) {
    return null;
  }

  // "Popular" is only honest when real ratings exist; otherwise the row is just featured listings.
  const hasRatings = data?.items.some((restaurant) => typeof restaurant.rating === "number");
  const heading = altTitle && !hasRatings ? altTitle : title;

  return (
    <section className="section" aria-labelledby={`${id}-heading`}>
      <div className="section-head">
        <div>
          <h2 id={`${id}-heading`} className="section-title">
            {heading}
          </h2>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
        {seeAllTo && data?.items.length > 0 && <Link to={seeAllTo}>See all</Link>}
      </div>
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data && <Loading label={`Loading ${heading}`} variant="cards" />}
      {data && (
        <ul className="card-grid">
          {data.items.map((restaurant) => (
            <RestaurantCard key={restaurant.id} restaurant={restaurant} />
          ))}
        </ul>
      )}
    </section>
  );
}
