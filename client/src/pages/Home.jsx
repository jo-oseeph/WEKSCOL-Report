import React, { useState } from "react";
import { Link } from "react-router-dom";
import Hero from "../components/Hero.jsx";
import { AvatarPicker, UserAvatar } from "../components/UserAvatar.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import "../styles/Site.css";

function Home() {
  const { user, isLoading, logout, updateProfile, changePassword } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isProfileDetailsOpen, setIsProfileDetailsOpen] = useState(false);
  const [isPasswordFormOpen, setIsPasswordFormOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [profileForm, setProfileForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    idNumber: "",
    avatarUrl: "",
  });
  const [formMessage, setFormMessage] = useState("");
  const reportsTarget = user ? "/reports" : "#auth-panel";
  const userInitials = user
    ? `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase()
    : "";

  function openProfileDetails() {
    setProfileForm({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      idNumber: user.idNumber || "",
      avatarUrl: user.avatarUrl || "",
    });
    setIsProfileDetailsOpen(true);
    setIsProfileOpen(false);
  }

  function handleAvatarChange(avatarUrl) {
    setProfileForm((current) => ({ ...current, avatarUrl }));
  }

  async function handleProfileSubmit(event) {
    event.preventDefault();
    setFormMessage("");
    try {
      const updatedUser = await updateProfile(profileForm);
      setProfileForm({
        firstName: updatedUser.firstName || "",
        lastName: updatedUser.lastName || "",
        email: updatedUser.email || "",
        idNumber: updatedUser.idNumber || "",
        avatarUrl: updatedUser.avatarUrl || "",
      });
      setFormMessage("Profile updated successfully.");
    } catch (error) {
      setFormMessage(error.message || "Unable to update your profile.");
    }
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
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setFormMessage("Password changed successfully.");
    } catch (error) {
      setFormMessage(error.message || "Unable to change password.");
    }
  }

  return (
    <div className="site-shell">
      <header className="site-topbar">
        <Link className="site-brand" to="/">
          <img src="/images/logo1.png" alt="WEKSCOL" className="site-logo" />
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
          {user?.role === "admin" ? <Link className="site-nav-link" to="/admin">Admin</Link> : null}
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
              <UserAvatar
                user={user}
                initials={userInitials}
                className="site-user-avatar"
              />
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
                <button
                  type="button"
                  onClick={openProfileDetails}
                >
                  My Profile
                </button>
                <button type="button" onClick={logout}>
                  Log out
                </button>
              </div>
            ) : null}
            {isProfileDetailsOpen ? (
              <div className="site-user-details">
                <div className="site-user-details-header">
                  <AvatarPicker
                    user={{
                      ...user,
                      avatarUrl: profileForm.avatarUrl || user.avatarUrl,
                    }}
                    initials={userInitials}
                    onChange={handleAvatarChange}
                    className="site-user-details-avatar"
                  />
                  <div>
                    <strong>
                      {user.firstName} {user.lastName}
                    </strong>
                    <small>{user.email}</small>
                  </div>
                </div>

                <form
                  className="site-user-profile-form"
                  onSubmit={handleProfileSubmit}
                >
                  <div className="site-user-form-row two-column">
                    <div>
                      <span>First Name</span>
                      <strong>{user.firstName}</strong>
                    </div>
                    <div>
                      <span>Last Name</span>
                      <strong>{user.lastName}</strong>
                    </div>
                  </div>
                  <div className="site-user-form-row two-column">
                    <div>
                      <span>Email</span>
                      <strong>{user.email}</strong>
                    </div>
                    <div>
                      <span>ID Number</span>
                      <strong>{user.idNumber}</strong>
                    </div>
                  </div>
                  <button type="submit" className="site-user-submit">
                    Update profile
                  </button>
                </form>
                <div className="site-user-profile-form">
                  <button
                    type="button"
                    className="site-user-submit"
                    onClick={() => {
                      setIsPasswordFormOpen((isOpen) => !isOpen);
                      setFormMessage("");
                    }}
                  >
                    {isPasswordFormOpen
                      ? "Cancel password change"
                      : "Change password"}
                  </button>
                  {isPasswordFormOpen ? (
                    <form
                      className="site-user-profile-form"
                      onSubmit={handlePasswordSubmit}
                    >
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
                      <button type="submit" className="site-user-submit">
                        Save password
                      </button>
                    </form>
                  ) : null}
                  {formMessage ? (
                    <p className="site-user-form-message">{formMessage}</p>
                  ) : null}
                  <button
                    type="button"
                    className="site-user-details-close"
                    onClick={() => setIsProfileDetailsOpen(false)}
                  >
                    Close
                  </button>
                </div>
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
