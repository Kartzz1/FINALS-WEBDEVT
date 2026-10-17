export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 50;

export function pageParams(query) {
  return {
    page: query.page ?? 1,
    limit: query.limit ?? DEFAULT_PAGE_SIZE,
  };
}

export function toPage({ items, total }, { page, limit }) {
  return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
}
