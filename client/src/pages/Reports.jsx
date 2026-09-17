import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { reportCategories } from "../data/reportsData";
import CategoryTabs from "../components/CategoryTabs.jsx";
import ReportViewer from "../components/ReportViewer.jsx";
import ReportsOverview from "../components/ReportsOverview.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import "../styles/Reports.css";

function Reports() {
  const { categoryId, subcategoryId, reportId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const querySectionRef = useRef(null);
  const userInitials =
    `${user?.firstName?.[0] || ""}${user?.lastName?.[0] || ""}`.toUpperCase();
  const selectedCategory =
    reportCategories.find((category) => category.id === categoryId) || null;
  const selectedSubcategory =
    selectedCategory?.subcategories.find(
      (subcategory) => subcategory.id === subcategoryId,
    ) || null;
  const selectedReport =
    selectedSubcategory?.reports.find((report) => report.id === reportId) ||
    null;

  useEffect(() => {
    if (!selectedReport || !querySectionRef.current) return;

    querySectionRef.current.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [selectedReport]);

  function handleSelectReport(category, subcategory, report) {
    navigate(`/reports/${category.id}/${subcategory.id}/${report.id}`);
  }

  return (
    <div className="reports-shell">
      <header className="reports-topbar">
        <div className="reports-topbar-inner">
          <div className="reports-topbar-branding">
            <img
              className="reports-topbar-logo-image"
              src="/images/logo1.png"
              alt="West Kenya Sugar Co. logo"
            />
            <div className="reports-topbar-brand-copy">
              <strong>WEKSCOL Report</strong>
              <small>West Kenya Sugar Co.</small>
            </div>
          </div>
          <div className="reports-navigation">
            <Link className="reports-home-link" to="/">
              Home
            </Link>
            <CategoryTabs
              categories={reportCategories}
              selectedCategory={selectedCategory}
              selectedSubcategory={selectedSubcategory}
              selectedReport={selectedReport}
              onSelectReport={handleSelectReport}
            />
          </div>
          <div className="reports-topbar-user">
            <button
              type="button"
              className="reports-user-trigger"
              aria-expanded={isProfileOpen}
              onClick={() => setIsProfileOpen((isOpen) => !isOpen)}
            >
              <div className="reports-topbar-avatar">{userInitials}</div>
              <div className="reports-topbar-user-copy">
                <strong>
                  {user?.firstName} {user?.lastName}
                </strong>
                <small>{user?.email}</small>
              </div>
              <span className="reports-user-chevron" aria-hidden="true">
                &#9662;
              </span>
            </button>
            {isProfileOpen ? (
              <div className="reports-user-menu">
                <button type="button" onClick={logout}>
                  Log out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>
      <main className="reports-page">
        <ReportsOverview hasSelectedReport={Boolean(selectedReport)} />
        {selectedReport ? (
          <section
            className="reports-content-panel reports-query-panel"
            ref={querySectionRef}
          >
            <ReportViewer report={selectedReport} key={selectedReport.id} />
          </section>
        ) : null}
      </main>
    </div>
  );
}

export default Reports;
