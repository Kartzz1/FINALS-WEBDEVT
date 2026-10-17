import { useAuth } from "../../context/AuthContext.jsx";

export default function ServerBanner() {
  const { serverDown, retry } = useAuth();
  if (!serverDown) {
    return null;
  }
  return (
    <div className="server-banner" role="alert">
      <div className="container">
        <strong>We cannot reach the reservation server.</strong> Make sure the backend is running, then{" "}
        <button type="button" className="link-button" onClick={retry}>
          try again
        </button>
        .
      </div>
    </div>
  );
}
