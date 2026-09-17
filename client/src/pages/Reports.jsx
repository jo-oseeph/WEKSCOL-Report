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
  const { user, logout, changePassword } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isProfileDetailsOpen, setIsProfileDetailsOpen] = useState(false);
  const [isPasswordFormOpen, setIsPasswordFormOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [formMessage, setFormMessage] = useState("");

  const querySectionRef = useRef(null);
  const userInitials = `${user?.firstName?.[0] || ""}${user?.lastName?.[0] || ""}`.toUpperCase();
  const selectedCategory = reportCategories.find((category) => category.id === categoryId) || null;
  const selectedSubcategory = selectedCategory?.subcategories.find((subcategory) => subcategory.id === subcategoryId) || null;
  const selectedReport = selectedSubcategory?.reports.find((report) => report.id === reportId) || null;

  useEffect(() => {
    if (!selectedReport || !querySectionRef.current) return;
    querySectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedReport]);

  function handleSelectReport(category, subcategory, report) {
    navigate(`/reports/${category.id}/${subcategory.id}/${report.id}`);
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
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setFormMessage("Password changed successfully.");
    } catch (error) {
      setFormMessage(error.message || "Unable to change password.");
    }
  }

  return (
    <div className="reports-shell">
      <header className="reports-topbar">
        <div className="reports-topbar-inner">
          <div className="reports-topbar-branding">
            <div className="reports-topbar-brand-copy">
              <strong>WEKSCOL Report</strong>
              <small>West Kenya Sugar Co.</small>
            </div>
          </div>

          <div className="reports-navigation">
            <Link className="reports-home-link" to="/">Home</Link>
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
                <strong>{user?.firstName} {user?.lastName}</strong>
                <small>{user?.email}</small>
              </div>
              <span className="reports-user-chevron" aria-hidden="true">&#9662;</span>
            </button>

            {isProfileOpen ? (
              <div className="reports-user-menu">
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileDetailsOpen(true);
                    setIsProfileOpen(false);
                  }}
                >
                  My Profile
                </button>
                <button type="button" onClick={logout}>Log out</button>
              </div>
            ) : null}

            {isProfileDetailsOpen ? (
              <div className="reports-user-details">
                <div className="reports-user-details-header">
                  <div className="reports-user-details-avatar">{userInitials}</div>
                  <div>
                    <strong>{user?.firstName} {user?.lastName}</strong>
                    <small>{user?.email}</small>
                  </div>
                </div>

                <div className="reports-user-profile-form">
                  <div className="site-user-form-row two-column">
                    <div><span>First Name</span><strong>{user?.firstName}</strong></div>
                    <div><span>Last Name</span><strong>{user?.lastName}</strong></div>
                  </div>
                  <div className="site-user-form-row two-column">
                    <div><span>Email</span><strong>{user?.email}</strong></div>
                    <div><span>ID Number</span><strong>{user?.idNumber}</strong></div>
                  </div>

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
                    <form className="reports-user-profile-form" onSubmit={handlePasswordSubmit}>
                      <label>
                        <span>Current password</span>
                        <input
                          type="password"
                          value={passwordForm.currentPassword}
                          onChange={(event) =>
                            setPasswordForm((current) => ({
                              ...current,
                              currentPassword: event.target.value,
                            }))
                          }
                          required
                        />
                      </label>
                      <label>
                        <span>New password</span>
                        <input
                          type="password"
                          value={passwordForm.newPassword}
                          onChange={(event) =>
                            setPasswordForm((current) => ({
                              ...current,
                              newPassword: event.target.value,
                            }))
                          }
                          minLength="6"
                          required
                        />
                      </label>
                      <label>
                        <span>Confirm new password</span>
                        <input
                          type="password"
                          value={passwordForm.confirmPassword}
                          onChange={(event) =>
                            setPasswordForm((current) => ({
                              ...current,
                              confirmPassword: event.target.value,
                            }))
                          }
                          minLength="6"
                          required
                        />
                      </label>
                      <button type="submit" className="site-user-submit">Save password</button>
                    </form>
                  ) : null}

                  {formMessage ? <p className="site-user-form-message">{formMessage}</p> : null}
                  <button type="button" className="reports-user-details-close" onClick={() => setIsProfileDetailsOpen(false)}>
                    Close
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main className="reports-page">
        <ReportsOverview hasSelectedReport={Boolean(selectedReport)} />
        {selectedReport ? (
          <section className="reports-content-panel reports-query-panel" ref={querySectionRef}>
            <ReportViewer report={selectedReport} key={selectedReport.id} />
          </section>
        ) : null}
      </main>
    </div>
  );
}

export default Reports;