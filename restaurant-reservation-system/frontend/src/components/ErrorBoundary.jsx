import { Component } from "react";

// Catches unexpected rendering errors so the visitor sees a helpful message
// instead of a blank white page.
export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error("Unexpected interface error:", error);
  }

  render() {
    if (!this.state.failed) {
      return this.props.children;
    }
    return (
      <div className="error-page" role="alert">
        <h1>Something went wrong</h1>
        <p>The page ran into an unexpected problem. Your reservations are safe. Reload to try again.</p>
        <div className="actions" style={{ justifyContent: "center" }}>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            Reload the page
          </button>
        </div>
      </div>
    );
  }
}
