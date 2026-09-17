import React, { useState } from "react";
import { Link } from "react-router-dom";
import Hero from "../components/Hero.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import "../styles/Site.css";

function Home() {
  const { user, isLoading, logout } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const reportsTarget = user ? "/reports" : "#auth-panel";
  const userInitials = user
    ? `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase()
    : "";

  return (
    <div className="site-shell">
      <header className="site-topbar">
        <Link className="site-brand" to="/">
          <img
            className="site-brand-logo"
            src="/images/logo1.png"
            alt="West Kenya Sugar Co. logo"
          />
          <span className="site-brand-copy">
            <strong>WEKSCOL Report</strong>
            <small>West Kenya Sugar Co.</small>
          </span>
        </Link>
        <nav className="site-nav" aria-label="Main navigation">
          <Link className="site-nav-link active" to="/">
            Home
          </Link>
          {isLoading ? (
            <span className="site-nav-link">Reports</span>
          ) : user ? (
            <Link className="site-nav-link" to={reportsTarget}>
              Reports
            </Link>
          ) : (
            <a className="site-nav-link" href={reportsTarget}>
              Reports
            </a>
          )}
        </nav>
        {user ? (
          <div className="site-user-profile">
            <button
              type="button"
              className="site-user-trigger"
              aria-expanded={isProfileOpen}
              aria-label={`Open profile menu for ${user.firstName} ${user.lastName}`}
              onClick={() => setIsProfileOpen((isOpen) => !isOpen)}
            >
              <div className="site-user-avatar">{userInitials}</div>
              <div className="site-user-copy">
                <strong>
                  {user.firstName} {user.lastName}
                </strong>
                <small>{user.email}</small>
              </div>
              <span className="site-user-chevron" aria-hidden="true">
                &#9662;
              </span>
            </button>
            {isProfileOpen ? (
              <div className="site-user-menu">
                <button type="button" onClick={logout}>
                  Log out
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </header>
      <Hero />
    </div>
  );
}

export default Home;
