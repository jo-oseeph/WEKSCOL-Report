import React, { useCallback, useEffect, useState } from "react";
import { admin as adminApi } from "../../api/api.js";
import "../../styles/admin/AdminOverview.css";

function formatDate(value) { return value ? new Date(Number(value)).toLocaleString() : "Never"; }

function AdminOverview() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(() => adminApi.getOverview().then(setData).catch((requestError) => setError(requestError.message)), []);
  useEffect(() => { load(); const timer = window.setInterval(() => adminApi.getLiveActivity().then((result) => setData((current) => current ? { ...current, recentActivity: result.activity.rows || [] } : current)).catch(() => {}), 15000); return () => window.clearInterval(timer); }, [load]);
  if (error) return <section className="admin-page"><AdminHeader title="Overview" subtitle="A quick view of your report operations." /><div className="admin-state admin-state-error">{error}<button type="button" onClick={() => { setError(""); load(); }}>Try again</button></div></section>;
  if (!data) return <section className="admin-page"><AdminHeader title="Overview" subtitle="A quick view of your report operations." /><div className="admin-state">Loading overview…</div></section>;
  const cards = [["Total users", Object.values(data.users || {}).reduce((sum, value) => sum + value, 0)], ["Pending approvals", data.users?.pending || 0], ["Report categories", data.categories || 0], ["Reports run today", data.reportsRunToday || 0]];
  return <section className="admin-page"><AdminHeader title="Overview" subtitle="A quick view of users, access and report activity." /><div className="admin-kpi-grid">{cards.map(([label, value]) => <article className="admin-kpi" key={label}><span>{label}</span><strong>{value}</strong></article>)}</div><div className="admin-panel"><div className="admin-panel-heading"><div><h2>Recent activity</h2><p>Live operational events from the last few actions.</p></div><span className="admin-live-dot">Live · 15s</span></div>{data.recentActivity?.length ? <div className="admin-activity-list">{data.recentActivity.map((item) => <div className="admin-activity-row" key={item.id}><span className={`admin-action-tag admin-action-${item.action}`}>{item.action}</span><div><strong>{item.actor_first_name ? `${item.actor_first_name} ${item.actor_last_name}` : item.actor_email || "System"}</strong><small>{item.report_id || "Account administration"}</small></div><time>{formatDate(item.created_at)}</time></div>)}</div> : <EmptyState text="No activity has been recorded yet." />}</div></section>;
}

export function AdminHeader({ title, subtitle }) { return <header className="admin-page-header"><div><span className="admin-eyebrow">Administration</span><h1>{title}</h1><p>{subtitle}</p></div></header>; }
export function EmptyState({ text }) { return <div className="admin-state">{text}</div>; }
export default AdminOverview;