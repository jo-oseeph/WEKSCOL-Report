import React, { useEffect, useMemo, useState } from "react";
import AppNavbar from "../components/AppNavbar.jsx";
import { admin as adminApi } from "../api/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import "../styles/Site.css";
import "../styles/Admin.css";

function Admin() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [selectedPermissions, setSelectedPermissions] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const currentUserId = user ? user.id : null;

  const pendingUsers = useMemo(
    () => users.filter((account) => account.status === "pending"),
    [users],
  );
  const managedUsers = useMemo(
    () => users.filter((account) => account.id !== currentUserId && account.role === "user"),
    [users, currentUserId],
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
      <AppNavbar />

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