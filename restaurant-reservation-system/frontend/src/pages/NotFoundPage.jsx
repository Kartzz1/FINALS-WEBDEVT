import { ButtonLink } from "../components/ui/Button.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { usePageTitle } from "../hooks/usePageTitle.js";

export default function NotFoundPage() {
  usePageTitle("Page not found");
  return (
    <EmptyState
      title="Page not found"
      action={
        <ButtonLink to="/" variant="primary">
          Back to home
        </ButtonLink>
      }
    >
      The page you are looking for does not exist or has moved.
    </EmptyState>
  );
}
