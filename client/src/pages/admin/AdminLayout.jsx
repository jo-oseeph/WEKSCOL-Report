import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { FaBars, FaBook, FaChartLine, FaClipboardList, FaHome, FaTimes, FaUsers, FaUserShield } from "react-icons/fa";
import { useAuth } from "../../context/AuthContext.jsx";
import { admin as adminApi } from "../../api/api.js";
import "../../styles/admin/Admin.css";
import "../../styles/admin/AdminLayout.css";

const links = [
  { to: "/", label: "Home", icon: FaHome, end: true },
  { to: "/admin", label: "Overview", icon: FaChartLine, end: true },
  { to: "/admin/users", label: "Users", icon: FaUsers },
  { to: "/admin/access", label: "Access control", icon: FaUserShield },
  { to: "/admin/catalog", label: "Report catalog", icon: FaBook },
  { to: "/admin/activity", label: "Activity log", icon: FaClipboardList },
];

function AdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let mounted = true;
    adminApi.getUsers({ status: "pending", pageSize: 1 }).then((result) => {
      if (mounted) setPending(result.total || result.users?.length || 0);
    }).catch(() => {});
    return () => { mounted = false; };
  }, [location.pathname]);

  const initials = `${user?.firstName?.[0] || "A"}${user?.lastName?.[0] || ""}`.toUpperCase();

  return (
    <div className="admin-shell">
      <button type="button" className="admin-mobile-toggle" aria-label={isOpen ? "Close admin navigation" : "Open admin navigation"} onClick={() => setIsOpen((value) => !value)}>
        {isOpen ? <FaTimes /> : <FaBars />}
      </button>
      {isOpen ? <button type="button" className="admin-backdrop" aria-label="Close navigation" onClick={() => setIsOpen(false)} /> : null}
      <aside className={`admin-sidebar${isOpen ? " admin-sidebar-open" : ""}`}>
        <div className="admin-sidebar-brand">
          <img src="/images/logo1.png" alt="WESCOL" />
          <div><strong>WESCOL</strong><span>Admin console</span></div>
        </div>
        <nav className="admin-sidebar-nav" aria-label="Admin navigation">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `admin-nav-link${isActive ? " admin-nav-link-active" : ""}`}>
              <Icon aria-hidden="true" /><span>{label}</span>{label === "Users" && pending > 0 ? <b>{pending}</b> : null}
            </NavLink>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <div className="admin-user-mini"><span>{initials}</span><div><strong>{user?.firstName} {user?.lastName}</strong><small>Administrator</small></div></div>
          <button type="button" onClick={logout}>Sign out</button>
        </div>
      </aside>
      <main className="admin-main"><Outlet /></main>
    </div>
  );
}

export default AdminLayout;