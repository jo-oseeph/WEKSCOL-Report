import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { FaBars, FaChartBar, FaHome, FaTimes } from "react-icons/fa";
import { useAuth } from "../context/AuthContext.jsx";
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
}) {
  const { user } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
        <NavLink end to="/" onClick={closeMenu} className={({ isActive }) => `app-nav-link${isActive ? " active" : ""}`}>
          <FaHome aria-hidden="true" /> Home
        </NavLink>
        {user ? (
          <NavLink to="/reports" onClick={closeMenu} className={({ isActive }) => `app-nav-link${isActive ? " active" : ""}`}>
            <FaChartBar aria-hidden="true" /> Reports
          </NavLink>
        ) : (
          <a className="app-nav-link" href="#auth-panel" onClick={closeMenu}>
            <FaChartBar aria-hidden="true" /> Reports
          </a>
        )}
        {reportCategories.length > 0 ? (
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