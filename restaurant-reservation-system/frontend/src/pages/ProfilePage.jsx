import { useState } from "react";
import Alert from "../components/ui/Alert.jsx";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import FormField from "../components/ui/FormField.jsx";
import PasswordField from "../components/ui/PasswordField.jsx";
import Badge from "../components/ui/Badge.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useAction } from "../hooks/useAction.js";
import { usePageTitle } from "../hooks/usePageTitle.js";
import { authService } from "../services/authService.js";
import { fieldErrors } from "../utils/errors.js";
import {
  compact,
  validateConfirm,
  validateEmail,
  validateName,
  validateNewPassword,
} from "../utils/validation.js";

function DetailsForm({ user, onSaved }) {
  const [form, setForm] = useState({ name: user.name, email: user.email, currentPassword: "" });
  const [errors, setErrors] = useState({});
  const { busy, error, run, setError } = useAction();

  function change(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function submit(event) {
    event.preventDefault();
    const emailChanged = form.email.trim().toLowerCase() !== user.email;
    const found = compact({
      name: validateName(form.name),
      email: validateEmail(form.email),
      currentPassword:
        emailChanged && !form.currentPassword ? "Enter your current password to change your email." : "",
    });
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setError("Please fix the highlighted fields.");
      return;
    }

    const body = { name: form.name.trim() };
    if (emailChanged) {
      body.email = form.email.trim();
      body.currentPassword = form.currentPassword;
    }
    const outcome = await run(() => authService.updateProfile(body), "Profile updated.");
    if (outcome.ok) {
      onSaved(outcome.result.user);
      setForm((previous) => ({ ...previous, currentPassword: "" }));
    } else {
      setErrors(fieldErrors(outcome.error));
    }
  }

  return (
    <Card as="section" aria-labelledby="details-heading">
      <h2 id="details-heading">Account details</h2>
      <form onSubmit={submit} noValidate>
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
          id="detailsPassword"
          name="currentPassword"
          label="Current password"
          autoComplete="current-password"
          hint="Only needed when you change your email."
          value={form.currentPassword}
          onChange={change}
          error={errors.currentPassword}
        />
        <Button type="submit" variant="primary" loading={busy}>
          Save details
        </Button>
      </form>
    </Card>
  );
}

function PasswordForm() {
  const empty = { currentPassword: "", password: "", confirm: "" };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const { busy, error, run, setError } = useAction();

  function change(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function submit(event) {
    event.preventDefault();
    const found = compact({
      currentPassword: form.currentPassword ? "" : "Enter your current password.",
      password:
        validateNewPassword(form.password) ||
        (form.password === form.currentPassword ? "Choose a password different from your current one." : ""),
      confirm: validateConfirm(form.password, form.confirm),
    });
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setError("Please fix the highlighted fields.");
      return;
    }

    const outcome = await run(
      () => authService.updateProfile({ currentPassword: form.currentPassword, password: form.password }),
      "Password changed. You were signed out on your other devices."
    );
    if (outcome.ok) setForm(empty);
    else setErrors(fieldErrors(outcome.error));
  }

  return (
    <Card as="section" aria-labelledby="password-heading">
      <h2 id="password-heading">Change password</h2>
      <form onSubmit={submit} noValidate>
        <Alert>{error}</Alert>
        <PasswordField
          id="currentPassword"
          name="currentPassword"
          label="Current password"
          autoComplete="current-password"
          value={form.currentPassword}
          onChange={change}
          error={errors.currentPassword}
          required
        />
        <PasswordField
          id="newPassword"
          name="password"
          label="New password"
          autoComplete="new-password"
          showRules
          value={form.password}
          onChange={change}
          error={errors.password}
          required
        />
        <PasswordField
          id="confirmPassword"
          name="confirm"
          label="Confirm new password"
          autoComplete="new-password"
          value={form.confirm}
          onChange={change}
          error={errors.confirm}
          required
        />
        <Button type="submit" variant="primary" loading={busy}>
          Change password
        </Button>
      </form>
    </Card>
  );
}

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  usePageTitle("Profile");

  return (
    <div className="narrow">
      <header className="page-header">
        <div>
          <h1>Your profile</h1>
          <p className="page-subtitle">
            Account type <Badge status={user.role} />
          </p>
        </div>
      </header>
      <div className="stack">
        <DetailsForm user={user} onSaved={updateUser} />
        <PasswordForm />
      </div>
    </div>
  );
}
