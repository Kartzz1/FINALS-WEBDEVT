import { useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import AuthShell from "../components/layout/AuthShell.jsx";
import Alert from "../components/ui/Alert.jsx";
import Button from "../components/ui/Button.jsx";
import FormField from "../components/ui/FormField.jsx";
import PasswordField from "../components/ui/PasswordField.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { usePageTitle } from "../hooks/usePageTitle.js";
import { fieldErrors } from "../utils/errors.js";
import { compact, validateEmail } from "../utils/validation.js";

export default function LoginPage() {
  const { user, login } = useAuth();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  usePageTitle("Log in");

  // Once login succeeds `user` is set and this redirect takes over.
  if (user) {
    const target = user.role === "admin" ? "/admin" : location.state?.from ?? "/restaurants";
    return <Navigate to={target} replace />;
  }

  function change(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    const found = compact({
      email: validateEmail(form.email),
      password: form.password ? "" : "Enter your password.",
    });
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setError("Please fix the highlighted fields.");
      return;
    }

    setBusy(true);
    try {
      await login({ email: form.email.trim(), password: form.password });
    } catch (err) {
      setError(err.message);
      setErrors(fieldErrors(err));
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to book and manage your reservations."
      footer={
        <>
          New here? <Link to="/register">Create an account</Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate>
        <Alert>{error}</Alert>
        <FormField
          id="email"
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={form.email}
          onChange={change}
          error={errors.email}
          required
        />
        <PasswordField
          id="password"
          name="password"
          label="Password"
          autoComplete="current-password"
          value={form.password}
          onChange={change}
          error={errors.password}
          required
        />
        <Button type="submit" variant="primary" block loading={busy}>
          {busy ? "Logging in" : "Log in"}
        </Button>
      </form>
    </AuthShell>
  );
}
