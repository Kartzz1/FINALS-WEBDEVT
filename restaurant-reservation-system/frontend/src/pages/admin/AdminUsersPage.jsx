import { useState } from "react";
import Alert from "../../components/ui/Alert.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import ConfirmDialog from "../../components/ui/ConfirmDialog.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import FormField from "../../components/ui/FormField.jsx";
import Loading from "../../components/ui/Loading.jsx";
import Modal from "../../components/ui/Modal.jsx";
import PasswordField from "../../components/ui/PasswordField.jsx";
import Pagination from "../../components/ui/Pagination.jsx";
import { useToast } from "../../components/ui/Toast.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useAction } from "../../hooks/useAction.js";
import { usePageTitle } from "../../hooks/usePageTitle.js";
import { useResource } from "../../hooks/useResource.js";
import { userService } from "../../services/userService.js";
import { fieldErrors } from "../../utils/errors.js";
import { compact, validateEmail, validateName, validateNewPassword } from "../../utils/validation.js";

const PAGE_SIZE = 10;

function UserForm({ user, isSelf, onSaved, onCancel }) {
  const [form, setForm] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
    role: user?.role ?? "user",
    password: "",
  });
  const [errors, setErrors] = useState({});
  const { busy, error, run } = useAction();

  function change(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function submit(event) {
    event.preventDefault();
    const found = compact({
      name: validateName(form.name),
      email: validateEmail(form.email),
      password: user && !form.password ? "" : validateNewPassword(form.password),
    });
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const body = { name: form.name.trim(), email: form.email.trim(), role: form.role };
    if (form.password) {
      body.password = form.password;
    }
    const save = user
      ? () => userService.update(user.id, body)
      : () => userService.create({ ...body, password: form.password });
    const outcome = await run(save);
    if (outcome.ok) onSaved(user ? "User updated." : "User added.");
    else setErrors(fieldErrors(outcome.error));
  }

  return (
    <form onSubmit={submit} noValidate>
      <Alert>{error}</Alert>
      <FormField id="u-name" name="name" label="Full name" value={form.name} onChange={change} error={errors.name} maxLength={100} required />
      <FormField
        id="u-email"
        name="email"
        label="Email"
        type="email"
        inputMode="email"
        value={form.email}
        onChange={change}
        error={errors.email}
        required
      />
      <FormField
        id="u-role"
        name="role"
        label="Role"
        as="select"
        value={form.role}
        onChange={change}
        error={errors.role}
        disabled={isSelf}
        hint={isSelf ? "You cannot change your own role." : undefined}
      >
        <option value="user">Customer</option>
        <option value="admin">Administrator</option>
      </FormField>
      <PasswordField
        id="u-password"
        name="password"
        label={user ? "New password" : "Password"}
        autoComplete="new-password"
        hint={user ? "Leave blank to keep the current password. Setting one signs the user out everywhere." : undefined}
        showRules={!user || Boolean(form.password)}
        value={form.password}
        onChange={change}
        error={errors.password}
        required={!user}
      />
      <div className="actions actions-end">
        <Button onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={busy}>
          Save user
        </Button>
      </div>
    </form>
  );
}

export default function AdminUsersPage() {
  const toast = useToast();
  const { user: me } = useAuth();
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const { busy, error, run } = useAction();
  usePageTitle("Manage users");

  const { data, loading, error: loadError, reload } = useResource(
    () => userService.list({ page, limit: PAGE_SIZE }),
    [page]
  );

  function saved(message) {
    setEditing(null);
    toast.success(message);
    reload();
  }

  async function remove() {
    const outcome = await run(() => userService.remove(toDelete.id), "User deleted.");
    setToDelete(null);
    if (outcome.ok) reload();
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Users</h1>
          <p className="page-subtitle">Customers and administrators who can sign in.</p>
        </div>
        <Button variant="primary" icon="plus" onClick={() => setEditing("new")}>
          Add user
        </Button>
      </header>

      <Alert>{error}</Alert>
      {loadError && <ErrorState error={loadError} onRetry={reload} />}
      {loading && !data && <Loading label="Loading users" variant="list" />}
      {data && data.items.length === 0 && <EmptyState title="No users found" />}

      {data && data.items.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((user) => (
                  <tr key={user.id}>
                    <td data-label="Name">
                      {user.name}
                      {user.id === me.id && <span className="muted"> (you)</span>}
                    </td>
                    <td data-label="Email">{user.email}</td>
                    <td data-label="Role">
                      <Badge status={user.role} />
                    </td>
                    <td data-label="Actions">
                      <div className="actions">
                        <Button size="sm" icon="edit" onClick={() => setEditing(user)}>
                          Edit
                        </Button>
                        {user.id !== me.id && (
                          <Button size="sm" variant="danger" icon="trash" onClick={() => setToDelete(user)}>
                            Delete
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
        </>
      )}

      <Modal open={Boolean(editing)} title={editing === "new" ? "Add user" : "Edit user"} onClose={() => setEditing(null)}>
        {editing && (
          <UserForm
            key={editing === "new" ? "new" : editing.id}
            user={editing === "new" ? null : editing}
            isSelf={editing !== "new" && editing.id === me.id}
            onSaved={saved}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete this user?"
        message={
          toDelete
            ? `${toDelete.name} (${toDelete.email}) will be removed. Users who have reservations, and the last administrator, cannot be deleted.`
            : ""
        }
        confirmLabel="Delete user"
        danger
        busy={busy}
        onConfirm={remove}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
