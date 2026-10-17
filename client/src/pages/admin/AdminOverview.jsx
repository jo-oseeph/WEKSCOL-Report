import React, { useCallback, useEffect, useState } from "react";
import { admin as adminApi } from "../../api/api.js";
import "../../styles/admin/AdminOverview.css";

// Feather-style 24x24 stroke icons, kept as plain path data (no icon library).
const KPI_ICONS = {
  users:
    "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20 M12 6v6l4 2",
  layers: "M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z",
  chart: "M18 20V10 M12 20V4 M6 20v-6",
};

function timeAgo(value) {
  if (!value) return "Never";
  const seconds = Math.max(0, Math.floor((Date.now() - Number(value)) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return new Date(Number(value)).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function fullDate(value) {
  return value ? new Date(Number(value)).toLocaleString() : "";
}

function actorName(item) {
  return item.actor_first_name
    ? `${item.actor_first_name} ${item.actor_last_name || ""}`.trim()
    : item.actor_email || "System";
}

function initials(name) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "S"
  );
}

function AdminOverview() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(
    () =>
      adminApi
        .getOverview()
        .then(setData)
        .catch((requestError) => setError(requestError.message)),
    [],
  );
  useEffect(() => {
    load();
    const timer = window.setInterval(
      () =>
        adminApi
          .getLiveActivity()
          .then((result) =>
            setData((current) =>
              current
                ? { ...current, recentActivity: result.activity.rows || [] }
                : current,
            ),
          )
          .catch(() => {}),
      15000,
    );
    return () => window.clearInterval(timer);
  }, [load]);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  if (error)
    return (
      <section className="admin-page">
        <AdminHeader
          title="Overview"
          subtitle="A quick view of your report operations."
        />
        <div className="admin-state admin-state-error">
          {error}
          <button
            type="button"
            onClick={() => {
              setError("");
              load();
            }}
          >
            Try again
          </button>
        </div>
      </section>
    );

  if (!data)
    return (
      <section className="admin-page">
        <header className="admin-hero">
          <div>
            <span className="admin-hero-date">{today}</span>
            <h1>Overview</h1>
            <p>Loading your report operations…</p>
          </div>
        </header>
        <div className="admin-kpi-grid" aria-busy="true">
          {[0, 1, 2, 3].map((index) => (
            <div className="admin-kpi admin-skeleton" key={index} />
          ))}
        </div>
      </section>
    );

  const totalUsers = Object.values(data.users || {}).reduce(
    (sum, value) => sum + value,
    0,
  );
  const pending = data.users?.pending || 0;
  const cards = [
    {
      label: "Total users",
      value: totalUsers,
      note: "All registered accounts",
      tone: "green",
      icon: KPI_ICONS.users,
    },
    {
      label: "Pending approvals",
      value: pending,
      note: pending ? "Waiting for your review" : "All caught up",
      tone: "amber",
      icon: KPI_ICONS.clock,
      alert: pending > 0,
    },
    {
      label: "Report categories",
      value: data.categories || 0,
      note: "Available in the catalog",
      tone: "blue",
      icon: KPI_ICONS.layers,
    },
    {
      label: "Reports run today",
      value: data.reportsRunToday || 0,
      note: "Since midnight",
      tone: "teal",
      icon: KPI_ICONS.chart,
    },
  ];

  // Greeting name: have the overview API return `me: { first_name }`, or swap
  // this line for your auth context. Falls back to "Admin".
  const greetingName = data.me?.first_name || data.me?.username || "Admin";
  const activity = (data.recentActivity || []).slice(0, 7);

  return (
    <section className="admin-page">
      <header className="admin-hero">
        <div>
          <span className="admin-hero-date">{today}</span>
          <h1>Hello, {greetingName}</h1>
          <p>Here is what is happening across your reports today.</p>
        </div>
        <span className="admin-live-pill">
          <i aria-hidden="true" />
          Live · updates every 15s
        </span>
      </header>

      <div className="admin-kpi-grid">
        {cards.map((card) => (
          <article
            className={`admin-kpi admin-kpi-${card.tone}${
              card.alert ? " admin-kpi-alert" : ""
            }`}
            key={card.label}
          >
            <span className="admin-kpi-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d={card.icon} />
              </svg>
            </span>
            <span className="admin-kpi-label">{card.label}</span>
            <strong className="admin-kpi-value">
              {card.value.toLocaleString()}
            </strong>
            <span className="admin-kpi-note">{card.note}</span>
          </article>
        ))}
      </div>

      <div className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <h2>Live operations</h2>
            <p>The latest actions across the platform.</p>
          </div>
        </div>
        {activity.length ? (
          <div className="admin-activity-list">
            {activity.map((item) => {
              const name = actorName(item);
              return (
                <div className="admin-activity-row" key={item.id}>
                  <span className="admin-avatar" aria-hidden="true">
                    {initials(name)}
                  </span>
                  <div className="admin-activity-main">
                    <strong>{name}</strong>
                    <small>{item.report_id || "Account administration"}</small>
                  </div>
                  <div className="admin-activity-meta">
                    <span
                      className={`admin-action-tag admin-action-${item.action}`}
                    >
                      {String(item.action).replace(/_/g, " ")}
                    </span>
                    <time title={fullDate(item.created_at)}>
                      {timeAgo(item.created_at)}
                    </time>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState text="No activity has been recorded yet." />
        )}
      </div>
    </section>
  );
}

export function AdminHeader({ title, subtitle }) {
  return (
    <header className="admin-page-header">
      <div>
        <span className="admin-eyebrow">Administration</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
    </header>
  );
}
export function EmptyState({ text }) {
  return <div className="admin-state">{text}</div>;
}
export default AdminOverview;