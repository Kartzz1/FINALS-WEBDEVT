import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import AuthShell from "../components/layout/AuthShell.jsx";
import Alert from "../components/ui/Alert.jsx";
import Button from "../components/ui/Button.jsx";
import FormField from "../components/ui/FormField.jsx";
import PasswordField from "../components/ui/PasswordField.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { usePageTitle } from "../hooks/usePageTitle.js";
import { fieldErrors } from "../utils/errors.js";
import {
  compact,
  validateConfirm,
  validateEmail,
  validateName,
  validateNewPassword,
} from "../utils/validation.js";

export default function RegisterPage() {
  const { user, register } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  usePageTitle("Create account");

  if (user) {
    return <Navigate to="/restaurants" replace />;
  }

  function change(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    const found = compact({
      name: validateName(form.name),
      email: validateEmail(form.email),
      password: validateNewPassword(form.password),
      confirm: validateConfirm(form.password, form.confirm),
    });
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setError("Please fix the highlighted fields.");
      return;
    }

    setBusy(true);
    try {
      await register({ name: form.name.trim(), email: form.email.trim(), password: form.password });
    } catch (err) {
      setError(err.message);
      setErrors(fieldErrors(err));
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="One account lets you book at every restaurant on the system."
      footer={
        <>
          Already registered? <Link to="/login">Log in</Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate>
        <p className="form-note">Fields marked * are required.</p>
        <Alert>{error}</Alert>
        <FormField
          id="name"
          name="name"
          label="Full name"
          autoComplete="name"
          value={form.name}
          onChange={change}
          error={errors.name}
          maxLength={100}
          required
        />
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
          autoComplete="new-password"
          showRules
          value={form.password}
          onChange={change}
          error={errors.password}
          required
        />
        <PasswordField
          id="confirm"
          name="confirm"
          label="Confirm password"
          autoComplete="new-password"
          value={form.confirm}
          onChange={change}
          error={errors.confirm}
          required
        />
        <Button type="submit" variant="primary" block loading={busy}>
          {busy ? "Creating account" : "Create account"}
        </Button>
      </form>
    </AuthShell>
  );
}
