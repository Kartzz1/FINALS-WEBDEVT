import { useState } from "react";
import { useAction } from "../../hooks/useAction.js";
import { catalogService } from "../../services/catalogService.js";
import { fieldErrors } from "../../utils/errors.js";
import { LIMITS, compact, validateEmail, validateText } from "../../utils/validation.js";
import Alert from "../ui/Alert.jsx";
import Button from "../ui/Button.jsx";
import FormField from "../ui/FormField.jsx";

const PRICE_OPTIONS = ["$", "$$", "$$$", "$$$$"];
const txt = (value) => value ?? "";

export function toForm(restaurant) {
  const r = restaurant ?? {};
  return {
    name: txt(r.name),
    category: txt(r.category),
    cuisine: (r.cuisine ?? []).join(", "),
    description: txt(r.description),
    address: txt(r.address),
    barangay: txt(r.barangay),
    city: txt(r.city),
    province: restaurant ? txt(r.province) : "Batangas",
    latitude: r.latitude == null ? "" : String(r.latitude),
    longitude: r.longitude == null ? "" : String(r.longitude),
    phone: txt(r.phone),
    email: txt(r.email),
    website: txt(r.website),
    image: txt(r.image),
    imageCredit: txt(r.imageCredit),
    openingHours: txt(r.openingHours),
    priceRange: txt(r.priceRange),
    rating: r.rating == null ? "" : String(r.rating),
    reviewCount: r.reviewCount == null ? "" : String(r.reviewCount),
    amenities: (r.amenities ?? []).join(", "),
    active: r.active ?? r.status !== "inactive",
  };
}

const orNull = (value) => value.trim() || null;
const toList = (value) => value.split(",").map((item) => item.trim()).filter(Boolean);
const toNumber = (value) => (value.trim() === "" ? null : Number(value));

// The shape the API expects. Empty text becomes null so a field can be cleared.
export function toPayload(form) {
  return {
    name: form.name.trim(),
    category: orNull(form.category),
    cuisine: toList(form.cuisine),
    description: orNull(form.description),
    address: orNull(form.address),
    barangay: orNull(form.barangay),
    city: form.city.trim(),
    province: orNull(form.province),
    latitude: toNumber(form.latitude),
    longitude: toNumber(form.longitude),
    phone: orNull(form.phone),
    email: form.email.trim() ? form.email.trim().toLowerCase() : null,
    website: orNull(form.website),
    image: orNull(form.image),
    imageCredit: orNull(form.imageCredit),
    openingHours: orNull(form.openingHours),
    priceRange: form.priceRange || null,
    rating: toNumber(form.rating),
    reviewCount: toNumber(form.reviewCount),
    amenities: toList(form.amenities),
    active: form.active,
  };
}

function webAddressError(value) {
  if (!value.trim()) return "";
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? "" : "Use a full web address starting with https://";
  } catch {
    return "Use a full web address starting with https://";
  }
}

function rangeError(value, label, min, max, whole = false) {
  if (!value.trim()) return "";
  const number = Number(value);
  if (!Number.isFinite(number)) return `${label} must be a number.`;
  if (whole && !Number.isInteger(number)) return `${label} must be a whole number.`;
  return number < min || number > max ? `${label} must be between ${min} and ${max}.` : "";
}

function validateForm(form) {
  const hasLat = form.latitude.trim() !== "";
  const hasLon = form.longitude.trim() !== "";
  return compact({
    name: validateText("a name", form.name, LIMITS.RESTAURANT_NAME_MAX),
    city: validateText("a city", form.city, LIMITS.CITY_MAX),
    email: form.email.trim() ? validateEmail(form.email) : "",
    website: webAddressError(form.website),
    image: webAddressError(form.image),
    latitude: rangeError(form.latitude, "Latitude", -90, 90) || (hasLon && !hasLat ? "Enter both coordinates, or leave both empty." : ""),
    longitude: rangeError(form.longitude, "Longitude", -180, 180) || (hasLat && !hasLon ? "Enter both coordinates, or leave both empty." : ""),
    rating: rangeError(form.rating, "Rating", 0, 5),
    reviewCount: rangeError(form.reviewCount, "Review count", 0, 10000000, true),
  });
}

export default function AdminRestaurantForm({ restaurant, onSaved, onCancel }) {
  const [form, setForm] = useState(() => toForm(restaurant));
  const [errors, setErrors] = useState({});
  const { busy, error, run, setError } = useAction();

  function change(event) {
    const { name, type, checked, value } = event.target;
    setForm({ ...form, [name]: type === "checkbox" ? checked : value });
  }

  async function submit(event) {
    event.preventDefault();
    const found = validateForm(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setError("Please fix the highlighted fields.");
      return;
    }

    const payload = toPayload(form);
    let body;
    if (restaurant) {
      // Only changed fields are sent. Fields you did not touch stay open to the importer;
      // fields you did change are protected from being overwritten by it.
      const before = toPayload(toForm(restaurant));
      body = Object.fromEntries(Object.entries(payload).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(before[key])));
      if (Object.keys(body).length === 0) {
        onSaved("No changes to save.");
        return;
      }
    } else {
      body = Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== null && !(Array.isArray(value) && value.length === 0)));
    }

    const outcome = await run(() =>
      restaurant ? catalogService.updateRestaurant(restaurant.id, body) : catalogService.createRestaurant(body)
    );
    if (outcome.ok) onSaved(restaurant ? "Restaurant updated." : "Restaurant added.");
    else setErrors(fieldErrors(outcome.error));
  }

  const field = (name, label, extra = {}) => (
    <FormField id={`rf-${name}`} name={name} label={label} value={form[name]} onChange={change} error={errors[name]} {...extra} />
  );

  return (
    <form onSubmit={submit} noValidate className="restaurant-form">
      <p className="form-note">Fields marked * are required.</p>
      <Alert>{error}</Alert>

      <fieldset className="form-section">
        <legend>Basics</legend>
        {field("name", "Name", { required: true, maxLength: LIMITS.RESTAURANT_NAME_MAX })}
        <div className="form-two">
          {field("category", "Category", { hint: "For example Restaurant, Cafe, or Bar." })}
          {field("cuisine", "Cuisine", { hint: "Separate several with commas." })}
        </div>
        {field("description", "Description", { as: "textarea", rows: 3, maxLength: 2000 })}
      </fieldset>

      <fieldset className="form-section">
        <legend>Location</legend>
        {field("address", "Street address")}
        <div className="form-two">
          {field("barangay", "Barangay")}
          {field("city", "City", { required: true })}
        </div>
        <div className="form-two">
          {field("province", "Province")}
          <span />
        </div>
        <div className="form-two">
          {field("latitude", "Latitude", { inputMode: "decimal", hint: "For example 13.9411" })}
          {field("longitude", "Longitude", { inputMode: "decimal", hint: "For example 121.1631" })}
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>Contact</legend>
        <div className="form-two">
          {field("phone", "Phone", { type: "tel", inputMode: "tel" })}
          {field("email", "Email", { type: "email", inputMode: "email" })}
        </div>
        {field("website", "Website", { type: "url", inputMode: "url", placeholder: "https://" })}
      </fieldset>

      <fieldset className="form-section">
        <legend>Details</legend>
        {field("openingHours", "Opening hours", { hint: "For example Mo-Fr 09:00-18:00; Sa 10:00-14:00" })}
        {field("amenities", "Amenities", { hint: "Separate with commas, for example Wi-Fi, Outdoor seating." })}
        <div className="form-two">
          <FormField id="rf-priceRange" name="priceRange" label="Price range" as="select" value={form.priceRange} onChange={change} error={errors.priceRange}>
            <option value="">Not set</option>
            {PRICE_OPTIONS.map((price) => (
              <option key={price} value={price}>
                {price}
              </option>
            ))}
          </FormField>
          <span />
        </div>
        <div className="form-two">
          {field("rating", "Rating (0 to 5)", { inputMode: "decimal", hint: "Leave empty unless you have a real rating." })}
          {field("reviewCount", "Number of reviews", { inputMode: "numeric" })}
        </div>
        {field("image", "Image address", { type: "url", inputMode: "url", placeholder: "https://", hint: "Only use images you are allowed to show." })}
        {field("imageCredit", "Image credit")}
      </fieldset>

      <label className="check">
        <input type="checkbox" name="active" checked={form.active} onChange={change} />
        Visible to guests and open for reservations
      </label>

      <div className="actions actions-end">
        <Button onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={busy}>
          Save restaurant
        </Button>
      </div>
    </form>
  );
}
