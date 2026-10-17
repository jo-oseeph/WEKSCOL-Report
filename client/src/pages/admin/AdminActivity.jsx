import React, { useEffect, useState } from "react";
import { admin as adminApi } from "../../api/api.js";
import { AdminHeader, EmptyState } from "./AdminOverview.jsx";
import "../../styles/admin/AdminActivity.css";

function AdminActivity() {
  const [result, setResult] = useState(null);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [error, setError] = useState("");
  async function load() {
    try {
      setResult(await adminApi.getActivity({ search, action, pageSize: 50 }));
    } catch (requestError) {
      setError(requestError.message);
    }
  }
  useEffect(() => {
    load();
  }, [action]);
  async function download() {
    const response = await adminApi.downloadActivity({ search, action });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = "activity-log.csv";
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section className="admin-page">
      <AdminHeader
        title="Activity log"
        subtitle="Review sign-ins, report usage and administration changes."
      />
      <div className="admin-toolbar">
        <input
          className="admin-input"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && load()}
          placeholder="Search activity"
        />
        <select
          className="admin-input"
          value={action}
          onChange={(event) => setAction(event.target.value)}
        >
          <option value="">All actions</option>
          <option value="sign_in">Sign in</option>
          <option value="run">Run</option>
          <option value="export">Export</option>
          <option value="approval">Approval</option>
          <option value="access_change">Access change</option>
          <option value="suspended">Suspended</option>
        </select>
        <button
          type="button"
          className="admin-button admin-button-primary"
          onClick={download}
        >
          Export CSV
        </button>
      </div>
      {error ? (
        <div className="admin-message admin-message-error">{error}</div>
      ) : null}
      {!result ? (
        <div className="admin-state">Loading activity…</div>
      ) : result.rows.length === 0 ? (
        <EmptyState text="No activity matches these filters." />
      ) : (
        <div className="admin-panel admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Action</th>
                <th>Actor</th>
                <th>Report</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <tr key={row.id}>
                  <td>{new Date(Number(row.created_at)).toLocaleString()}</td>
                  <td>
                    <span
                      className={`admin-action-tag admin-action-${row.action}`}
                    >
                      {row.action}
                    </span>
                  </td>
                  <td>{row.actor_email || "System"}</td>
                  <td>{row.report_id || "—"}</td>
                  <td>{JSON.stringify(row.metadata || {})}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
export default AdminActivity;
