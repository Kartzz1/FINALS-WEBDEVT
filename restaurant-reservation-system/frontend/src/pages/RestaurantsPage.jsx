import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import RestaurantCard from "../components/features/RestaurantCard.jsx";
import RestaurantFilters from "../components/features/RestaurantFilters.jsx";
import Button, { ButtonLink } from "../components/ui/Button.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import Loading from "../components/ui/Loading.jsx";
import Pagination from "../components/ui/Pagination.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useDebouncedValue } from "../hooks/useDebouncedValue.js";
import { usePageTitle } from "../hooks/usePageTitle.js";
import { useResource } from "../hooks/useResource.js";
import { catalogService } from "../services/catalogService.js";

const PAGE_SIZE = 12;
const FILTER_KEYS = ["q", "city", "cuisine", "category", "priceRange", "minRating", "hasTables", "sort"];
const REFINEMENTS = ["city", "cuisine", "category", "priceRange", "minRating", "hasTables"];

// Every search and filter lives in the address bar, so a result page can be bookmarked or shared.
export default function RestaurantsPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  usePageTitle("Restaurants");

  const values = Object.fromEntries(FILTER_KEYS.map((key) => [key, params.get(key) ?? ""]));
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [searchText, setSearchText] = useState(values.q);
  const debouncedSearch = useDebouncedValue(searchText, 350);

  const update = useCallback(
    (patch, { resetPage = true } = {}) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(patch)) {
            if (value) next.set(key, value);
            else next.delete(key);
          }
          if (resetPage) next.delete("page");
          return next;
        },
        { replace: true }
      );
    },
    [setParams]
  );

  useEffect(() => {
    if (debouncedSearch.trim() !== values.q) update({ q: debouncedSearch.trim() });
    // Only a finished pause in typing should change the address bar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [page]);

  const results = useResource(
    () => catalogService.searchRestaurants({ ...values, page, limit: PAGE_SIZE }),
    [params.toString()]
  );
  const facets = useResource(() => catalogService.facets(), []);

  const activeCount = REFINEMENTS.filter((key) => values[key]).length;
  const searching = Boolean(values.q) || activeCount > 0;

  function clearAll() {
    setSearchText("");
    setParams({}, { replace: true });
  }

  const { data } = results;

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Restaurants</h1>
          <p className="page-subtitle">Real restaurants in Batangas, loaded from our database.</p>
        </div>
      </header>

      <RestaurantFilters
        values={values}
        facets={facets.data?.facets}
        searchText={searchText}
        onSearchText={setSearchText}
        onChange={update}
        onClear={clearAll}
        activeCount={activeCount}
      />

      {results.error && <ErrorState error={results.error} onRetry={results.reload} />}
      {results.loading && !data && !results.error && <Loading label="Loading restaurants" variant="cards" />}

      {data && (
        <div aria-busy={results.loading}>
          <p className="results-bar" aria-live="polite">
            {data.total === 0
              ? "No restaurants found"
              : `${data.total.toLocaleString()} ${data.total === 1 ? "restaurant" : "restaurants"}`}
            {results.loading ? " · updating" : ""}
          </p>

          {data.total === 0 && searching && (
            <EmptyState
              title="No restaurants match your search"
              action={<Button onClick={clearAll}>Clear search and filters</Button>}
            >
              Try a different spelling, a nearby city, or fewer filters.
            </EmptyState>
          )}

          {data.total === 0 && !searching && (
            <EmptyState
              title="No restaurants have been added yet"
              action={
                user?.role === "admin" ? (
                  <ButtonLink to="/admin/restaurants" variant="primary">
                    Import restaurants
                  </ButtonLink>
                ) : null
              }
            >
              {user?.role === "admin"
                ? "Import real Batangas restaurants from OpenStreetMap in Administration."
                : "Restaurants will appear here once they have been added. Please check back soon."}
            </EmptyState>
          )}

          {data.items.length > 0 && (
            <>
              <ul className="card-grid">
                {data.items.map((restaurant) => (
                  <RestaurantCard key={restaurant.id} restaurant={restaurant} />
                ))}
              </ul>
              <Pagination
                page={data.page}
                totalPages={data.totalPages}
                onChange={(next) => update({ page: next > 1 ? String(next) : "" }, { resetPage: false })}
              />
            </>
          )}
        </div>
      )}
    </>
  );
}
