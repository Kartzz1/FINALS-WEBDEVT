import { env } from "./config/env.js";

// Responses list fields explicitly, so a new internal field can never reach the client by accident.

export function presentUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

const NO_TABLES = { count: 0, seats: 0, capacities: [] };

// Administrators additionally see the import bookkeeping.
export function presentRestaurant(restaurant, { admin = false } = {}) {
  const summary = restaurant.tableSummary ?? NO_TABLES;
  const view = {
    id: restaurant.id,
    name: restaurant.name,
    description: restaurant.description ?? null,
    cuisine: restaurant.cuisine ?? [],
    category: restaurant.category ?? null,
    address: restaurant.address ?? null,
    barangay: restaurant.barangay ?? null,
    city: restaurant.city ?? null,
    province: restaurant.province ?? null,
    latitude: restaurant.latitude ?? null,
    longitude: restaurant.longitude ?? null,
    phone: restaurant.phone ?? null,
    email: restaurant.email ?? null,
    website: restaurant.website ?? null,
    image: restaurant.image ?? null,
    imageCredit: restaurant.imageCredit ?? null,
    gallery: restaurant.gallery ?? [],
    openingHours: restaurant.openingHours ?? null,
    priceRange: restaurant.priceRange ?? null,
    rating: restaurant.rating ?? null,
    reviewCount: restaurant.reviewCount ?? null,
    amenities: restaurant.amenities ?? [],
    status: restaurant.active ? "active" : "inactive",
    availableTables: summary.count,
    tableSummary: summary,
    source: restaurant.source?.provider
      ? { provider: restaurant.source.provider, url: restaurant.source.url ?? null, license: restaurant.source.license ?? null }
      : null,
    createdAt: restaurant.createdAt,
    updatedAt: restaurant.updatedAt,
  };
  if (admin) {
    view.active = restaurant.active;
    view.externalPlaceId = restaurant.externalPlaceId ?? null;
    view.manualFields = restaurant.manualFields ?? [];
  }
  return view;
}

export function presentTable(table) {
  return { ...table, tableNumber: table.label, status: table.active ? "available" : "unavailable" };
}

const dateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: env.appTimezone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const timeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: env.appTimezone,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// The stored start time is an exact instant. The date and time the guest chose are
// derived from it in the restaurant's time zone, along with friendlier field names.
export function presentReservation(reservation) {
  const start = new Date(reservation.startAt);
  return {
    ...reservation,
    reservationDate: dateFormat.format(start),
    reservationTime: timeFormat.format(start),
    numberOfGuests: reservation.guestCount,
    specialRequest: reservation.notes || null,
  };
}
