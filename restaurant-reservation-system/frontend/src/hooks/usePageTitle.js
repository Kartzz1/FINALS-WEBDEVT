import { useEffect } from "react";

const SITE_NAME = "Restaurant Reservation System";

export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE_NAME}` : SITE_NAME;
  }, [title]);
}
