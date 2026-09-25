import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AvatarPicker, UserAvatar } from "../components/UserAvatar.jsx";
import { admin as adminApi } from "../api/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import "../styles/Site.css";
import "../styles/Admin.css";

function Admin() {
  const { user, logout, updateProfile, changePassword } = useAuth();
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [selectedPermissions, setSelectedPermissions] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isProfileDetailsOpen, setIsProfileDetailsOpen] = useState(false);
  const [isPasswordFormOpen, setIsPasswordFormOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [profileForm, setProfileForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    idNumber: "",
    avatarUrl: "",
  });
  const [formMessage, setFormMessage] = useState("");

  const userInitials =
    `${user?.firstName?.[0] || ""}${user?.lastName?.[0] || ""}`.toUpperCase();

  const pendingUsers = useMemo(
    () => users.filter((account) => account.status === "pending"),
    [users],
  );
  const managedUsers = useMemo(
    () => users.filter((account) => account.id !== user?.id),
    [users, user?.id],
  );

  useEffect(() => {
    Promise.all([adminApi.getUsers(), adminApi.getReports()])
      .then(([userResult, reportResult]) => {
        setUsers(userResult.users || []);
        setReports(reportResult.reports || []);
        setSelectedPermissions(
          Object.fromEntries(
            (userResult.users || []).map((account) => [account.id, account.permissions || []]),
          ),
        );
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setIsLoading(false));
  }, []);

  function openProfileDetails() {
    setProfileForm({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      idNumber: user.idNumber || "",
      avatarUrl: user.avatarUrl || "",
    });
    setIsProfileDetailsOpen(true);
    setIsProfileOpen(false);
  }

  function handleAvatarChange(avatarUrl) {
    setProfileForm((current) => ({ ...current, avatarUrl }));
  }

  async function handleProfileSubmit(event) {
    event.preventDefault();
    setFormMessage("");
    try {
      const updatedUser = await updateProfile(profileForm);
      setProfileForm({
        firstName: updatedUser.firstName || "",
        lastName: updatedUser.lastName || "",
        email: updatedUser.email || "",
        idNumber: updatedUser.idNumber || "",
        avatarUrl: updatedUser.avatarUrl || "",
      });
      setFormMessage("Profile updated successfully.");
    } catch (requestError) {
      setFormMessage(requestError.message || "Unable to update your profile.");
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();
    setFormMessage("");

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setFormMessage("New passwords do not match.");
      return;
    }

    try {
      await changePassword(passwordForm);
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setFormMessage("Password changed successfully.");
    } catch (requestError) {
      setFormMessage(requestError.message || "Unable to change password.");
    }
  }

  function updateLocalUser(updatedUser) {
    setUsers((current) => current.map((account) => (
      account.id === updatedUser.id ? updatedUser : account
    )));
    setSelectedPermissions((current) => ({
      ...current,
      [updatedUser.id]: updatedUser.permissions || [],
    }));
  }

  async function changeStatus(account, status) {
    setSavingUserId(account.id);
    setMessage("");
    setError("");
    try {
      const result = await adminApi.updateUserStatus(account.id, status);
      updateLocalUser(result.user);
      setMessage(`${account.firstName} ${account.lastName} is now ${status}.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingUserId(null);
    }
  }

  function togglePermission(userId, reportId) {
    setSelectedPermissions((current) => {
      const existing = current[userId] || [];
      return {
        ...current,
        [userId]: existing.includes(reportId)
          ? existing.filter((id) => id !== reportId)
          : [...existing, reportId],
      };
    });
  }

  async function savePermissions(account) {
    setSavingUserId(account.id);
    setMessage("");
    setError("");
    try {
      const result = await adminApi.updateUserPermissions(
        account.id,
        selectedPermissions[account.id] || [],
      );
      updateLocalUser(result.user);
      setMessage(`Report permissions saved for ${account.firstName} ${account.lastName}.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingUserId(null);
    }
  }

  if (isLoading) {
    return <main className="admin-page"><p className="admin-status">Loading administration...</p></main>;
  }

  return (
    <div className="admin-shell">
      <header className="site-topbar admin-site-topbar">
        <Link className="site-brand" to="/">
          <img src="/images/logo1.png" alt="WEKSCOL" className="site-logo" />
          <span className="site-brand-copy">
            <strong>WEKSCOL Report</strong>
            <small>West Kenya Sugar Co.</small>
          </span>
        </Link>

        <nav className="site-nav" aria-label="Main navigation">
          <Link className="site-nav-link" to="/">Home</Link>
          <Link className="site-nav-link" to="/reports">Reports</Link>
          <Link className="site-nav-link active" to="/admin">Admin</Link>
        </nav>

        <div className="site-user-profile">
          <button
            type="button"
            className="site-user-trigger"
            aria-expanded={isProfileOpen}
            aria-label={`Open profile menu for ${user.firstName} ${user.lastName}`}
            onClick={() => setIsProfileOpen((isOpen) => !isOpen)}
          >
            <UserAvatar
              user={user}
              initials={userInitials}
              className="site-user-avatar"
            />
            <div className="site-user-copy">
              <strong>{user.firstName} {user.lastName}</strong>
              <small>{user.email}</small>
            </div>
            <span className="site-user-chevron" aria-hidden="true">&#9662;</span>
          </button>

          {isProfileOpen ? (
            <div className="site-user-menu">
              <button type="button" onClick={openProfileDetails}>My Profile</button>
              <button type="button" onClick={logout}>Log out</button>
            </div>
          ) : null}

          {isProfileDetailsOpen ? (
            <div className="site-user-details">
              <div className="site-user-details-header">
                <AvatarPicker
                  user={{
                    ...user,
                    avatarUrl: profileForm.avatarUrl || user.avatarUrl,
                  }}
                  initials={userInitials}
                  onChange={handleAvatarChange}
                  className="site-user-details-avatar"
                />
                <div>
                  <strong>{user.firstName} {user.lastName}</strong>
                  <small>{user.email}</small>
                </div>
              </div>

              <form className="site-user-profile-form" onSubmit={handleProfileSubmit}>
                <div className="site-user-form-row two-column">
                  <div>
                    <span>First Name</span>
                    <strong>{user.firstName}</strong>
                  </div>
                  <div>
                    <span>Last Name</span>
                    <strong>{user.lastName}</strong>
                  </div>
                </div>
                <div className="site-user-form-row two-column">
                  <div>
                    <span>Email</span>
                    <strong>{user.email}</strong>
                  </div>
                  <div>
                    <span>ID Number</span>
                    <strong>{user.idNumber}</strong>
                  </div>
                </div>
                <button type="submit" className="site-user-submit">Update profile</button>
              </form>

              <div className="site-user-profile-form">
                <button
                  type="button"
                  className="site-user-submit"
                  onClick={() => {
                    setIsPasswordFormOpen((isOpen) => !isOpen);
                    setFormMessage("");
                  }}
                >
                  {isPasswordFormOpen ? "Cancel password change" : "Change password"}
                </button>

                {isPasswordFormOpen ? (
                  <form className="site-user-profile-form" onSubmit={handlePasswordSubmit}>
                    <label>
                      <span>Current password</span>
                      <input
                        type="password"
                        value={passwordForm.currentPassword}
                        onChange={(event) => setPasswordForm((current) => ({
                          ...current,
                          currentPassword: event.target.value,
                        }))}
                        required
                      />
                    </label>
                    <label>
                      <span>New password</span>
                      <input
                        type="password"
                        value={passwordForm.newPassword}
                        onChange={(event) => setPasswordForm((current) => ({
                          ...current,
                          newPassword: event.target.value,
                        }))}
                        minLength="6"
                        required
                      />
                    </label>
                    <label>
                      <span>Confirm new password</span>
                      <input
                        type="password"
                        value={passwordForm.confirmPassword}
                        onChange={(event) => setPasswordForm((current) => ({
                          ...current,
                          confirmPassword: event.target.value,
                        }))}
                        minLength="6"
                        required
                      />
                    </label>
                    <button type="submit" className="site-user-submit">Save password</button>
                  </form>
                ) : null}

                {formMessage ? <p className="site-user-form-message">{formMessage}</p> : null}
                <button
                  type="button"
                  className="site-user-details-close"
                  onClick={() => setIsProfileDetailsOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </header>

      <main className="admin-page">
        <section className="admin-heading">
          <div>
            <p className="admin-eyebrow">Administrator workspace</p>
            <h1>Users and report access</h1>
            <p>Approve new accounts and choose which reports each user can access.</p>
          </div>
          <div className="admin-summary-card">
            <strong>{pendingUsers.length}</strong>
            <span>Pending approval</span>
          </div>
        </section>

        {message ? <p className="admin-message admin-message-success">{message}</p> : null}
        {error ? <p className="admin-message admin-message-error">{error}</p> : null}

        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <h2>Pending users</h2>
              <p>These users cannot access reports until approved.</p>
            </div>
          </div>
          {pendingUsers.length === 0 ? (
            <p className="admin-empty">There are no users waiting for approval.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>User</th><th>Email</th><th>ID number</th><th>Actions</th></tr></thead>
                <tbody>
                  {pendingUsers.map((account) => (
                    <tr key={account.id}>
                      <td>{account.firstName} {account.lastName}</td>
                      <td>{account.email}</td>
                      <td>{account.idNumber}</td>
                      <td className="admin-actions-cell">
                        <button type="button" className="admin-button admin-button-primary" disabled={savingUserId === account.id} onClick={() => changeStatus(account, "approved")}>Approve</button>
                        <button type="button" className="admin-button admin-button-danger" disabled={savingUserId === account.id} onClick={() => changeStatus(account, "rejected")}>Reject</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <h2>Report permissions</h2>
              <p>Administrators have access to every report. Regular users see only selected reports.</p>
            </div>
          </div>
          {managedUsers.length === 0 ? (
            <p className="admin-empty">No other users have registered yet.</p>
          ) : (
            <div className="admin-user-permissions-list">
              {managedUsers.map((account) => (
                <article className="admin-user-permission-card" key={account.id}>
                  <div className="admin-user-permission-heading">
                    <div>
                      <h3>{account.firstName} {account.lastName}</h3>
                      <p>{account.email}</p>
                    </div>
                    <span className={`admin-status-badge admin-status-${account.status}`}>{account.status}</span>
                  </div>
                  <div className="admin-report-options">
                    {reports.map((report) => (
                      <label key={report.id} className="admin-report-option">
                        <input
                          type="checkbox"
                          checked={(selectedPermissions[account.id] || []).includes(report.id)}
                          disabled={account.status !== "approved" || savingUserId === account.id}
                          onChange={() => togglePermission(account.id, report.id)}
                        />
                        <span>{report.name}</span>
                      </label>
                    ))}
                  </div>
                  <button type="button" className="admin-button admin-button-primary" disabled={account.status !== "approved" || savingUserId === account.id} onClick={() => savePermissions(account)}>
                    Save report access
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default Admin;