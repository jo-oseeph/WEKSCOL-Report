import React, { useEffect, useState } from "react";
import { NavLink, useMatch } from "react-router-dom";
import { FaBars, FaChartBar, FaHome, FaTimes } from "react-icons/fa";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import CategoryTabs from "./CategoryTabs.jsx";
import UserMenu from "./UserMenu.jsx";
import "../styles/AppNavbar.css";
import "../styles/CategoryTabs.css";

function AppNavbar({
  reportCategories = [],
  selectedCategory = null,
  selectedSubcategory = null,
  selectedGroup = null,
  selectedReport = null,
  onSelectReport,
  isCatalogLoading = false,
}) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isReportsPage = Boolean(useMatch("/reports/*"));
  const hasReportTabs = reportCategories.length > 0;
  // On the reports page the category tabs are the Reports navigation, so a
  // separate "Reports" link next to them would only repeat it.
  const showReportsLink = !isReportsPage && !hasReportTabs;

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") setIsMenuOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  function closeMenu() {
    setIsMenuOpen(false);
  }

  function handleSignedOutReportsClick() {
    closeMenu();
    showToast("Please sign in to access reports.");
  }

  return (
    <header className="app-navbar">
      <NavLink className="app-brand" to="/" onClick={closeMenu}>
        <img src="/images/logo1.png" alt="WEKSCOL" className="app-brand-logo" />
        <span className="app-brand-copy">
          <strong>WEKSCOL Report</strong>
          <small>West Kenya Sugar Co.</small>
        </span>
      </NavLink>

      <nav className={`app-nav-links${isMenuOpen ? " app-nav-links-open" : ""}`} aria-label="Main navigation">
        {/* Home is always the first link, before the Reports link or the report tabs. */}
        <NavLink end to="/" onClick={closeMenu} className={({ isActive }) => `app-nav-link${isActive ? " active" : ""}`}>
          <FaHome aria-hidden="true" /> Home
        </NavLink>
        {showReportsLink ? (
          user ? (
            <NavLink to="/reports" onClick={closeMenu} className={({ isActive }) => `app-nav-link${isActive ? " active" : ""}`}>
              <FaChartBar aria-hidden="true" /> Reports
            </NavLink>
          ) : (
            <a className="app-nav-link" href="#auth-panel" onClick={handleSignedOutReportsClick}>
              <FaChartBar aria-hidden="true" /> Reports
            </a>
          )
        ) : null}
        {isReportsPage && isCatalogLoading ? (
          <div className="app-category-loading" role="status" aria-live="polite">
            <span className="app-category-spinner" aria-hidden="true" />
            <span>Loading reports...</span>
          </div>
        ) : hasReportTabs ? (
          <div className="app-category-navigation">
            <CategoryTabs
              categories={reportCategories}
              selectedCategory={selectedCategory}
              selectedSubcategory={selectedSubcategory}
              selectedGroup={selectedGroup}
              selectedReport={selectedReport}
              onSelectReport={onSelectReport}
            />
          </div>
        ) : null}
        <div className="app-mobile-user"><UserMenu /></div>
      </nav>

      <div className="app-desktop-user"><UserMenu /></div>
      <button type="button" className={`app-menu-toggle${isMenuOpen ? " app-menu-toggle-open" : ""}`} aria-label={isMenuOpen ? "Close menu" : "Open menu"} aria-expanded={isMenuOpen} onClick={() => setIsMenuOpen((open) => !open)}>
        <FaBars className="app-menu-icon app-menu-bars" aria-hidden="true" />
        <FaTimes className="app-menu-icon app-menu-close" aria-hidden="true" />
      </button>
    </header>
  );
}

export default AppNavbar;