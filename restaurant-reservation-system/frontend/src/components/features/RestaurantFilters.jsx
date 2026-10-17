import { useState } from "react";
import Button from "../ui/Button.jsx";
import FormField from "../ui/FormField.jsx";
import Icon from "../ui/Icon.jsx";

const SORTS = [
  { value: "featured", label: "Featured" },
  { value: "rating", label: "Highest rated" },
  { value: "name", label: "Name, A to Z" },
  { value: "price", label: "Price, low to high" },
  { value: "newest", label: "Recently added" },
];
const RATINGS = [
  { value: "", label: "Any rating" },
  { value: "3", label: "3.0 and up" },
  { value: "3.5", label: "3.5 and up" },
  { value: "4", label: "4.0 and up" },
  { value: "4.5", label: "4.5 and up" },
];
const PRICES = [
  { value: "", label: "Any price" },
  { value: "$", label: "$" },
  { value: "$$", label: "$$" },
  { value: "$$$", label: "$$$" },
  { value: "$$$$", label: "$$$$" },
];

// The options come from what is really in the database. A value from the address bar
// that is not (yet) in the list is kept, so a shared link still shows its own filter.
function optionsFrom(rows, current, anyLabel) {
  const names = (rows ?? []).map((row) => row.name);
  if (current && !names.includes(current)) names.unshift(current);
  return [{ value: "", label: anyLabel }, ...names.map((name) => ({ value: name, label: name }))];
}

function Select({ id, label, value, options, onChange }) {
  return (
    <FormField id={id} label={label} as="select" value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </FormField>
  );
}

export default function RestaurantFilters({ values, facets, searchText, onSearchText, onChange, onClear, activeCount }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="filters" aria-label="Search and filter restaurants">
      <div className="filters-top">
        <div className="search-field">
          <label htmlFor="restaurant-search" className="visually-hidden">
            Search restaurants
          </label>
          <div className="search-input">
            <Icon name="search" size={18} />
            <input
              id="restaurant-search"
              type="search"
              value={searchText}
              maxLength={100}
              placeholder="Search by name, city, or cuisine"
              onChange={(event) => onSearchText(event.target.value)}
              autoComplete="off"
            />
          </div>
        </div>
        <Select
          id="sort"
          label="Sort by"
          value={values.sort || "featured"}
          options={SORTS}
          onChange={(value) => onChange({ sort: value === "featured" ? "" : value })}
        />
        <Button
          className="filters-toggle"
          icon="sliders"
          aria-expanded={open}
          aria-controls="filters-panel"
          onClick={() => setOpen((current) => !current)}
        >
          Filters{activeCount > 0 ? ` (${activeCount})` : ""}
        </Button>
      </div>

      <div id="filters-panel" className="filters-panel" data-open={open}>
        <div className="filters-grid">
          <Select id="filter-city" label="City" value={values.city} options={optionsFrom(facets?.cities, values.city, "All cities")} onChange={(value) => onChange({ city: value })} />
          <Select id="filter-cuisine" label="Cuisine" value={values.cuisine} options={optionsFrom(facets?.cuisines, values.cuisine, "All cuisines")} onChange={(value) => onChange({ cuisine: value })} />
          <Select id="filter-category" label="Category" value={values.category} options={optionsFrom(facets?.categories, values.category, "All categories")} onChange={(value) => onChange({ category: value })} />
          <Select id="filter-price" label="Price range" value={values.priceRange} options={PRICES} onChange={(value) => onChange({ priceRange: value })} />
          <Select id="filter-rating" label="Rating" value={values.minRating} options={RATINGS} onChange={(value) => onChange({ minRating: value })} />
          <label className="check filters-check">
            <input
              type="checkbox"
              checked={values.hasTables === "true"}
              onChange={(event) => onChange({ hasTables: event.target.checked ? "true" : "" })}
            />
            Only restaurants with open tables
          </label>
        </div>
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear all filters
          </Button>
        )}
      </div>
    </section>
  );
}
