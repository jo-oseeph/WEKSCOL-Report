import React, { useState } from "react";
import { Link } from "react-router-dom";
import { AvatarPicker, UserAvatar } from "./UserAvatar.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const emptyProfile = {
  firstName: "",
  lastName: "",
  email: "",
  idNumber: "",
  avatarUrl: "",
};

const emptyPassword = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

function UserMenu() {
  const { user, logout, updateProfile, changePassword } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [profileForm, setProfileForm] = useState(emptyProfile);
  const [passwordForm, setPasswordForm] = useState(emptyPassword);
  const [message, setMessage] = useState("");

  if (!user) return null;

  const initials = `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase();

  function openProfileDetails() {
    setProfileForm({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      idNumber: user.idNumber || "",
      avatarUrl: user.avatarUrl || "",
    });
    setMessage("");
    setIsDetailsOpen(true);
    setIsOpen(false);
  }

  async function handleProfileSubmit(event) {
    event.preventDefault();
    setMessage("");
    try {
      const updatedUser = await updateProfile(profileForm);
      setProfileForm({
        firstName: updatedUser.firstName || "",
        lastName: updatedUser.lastName || "",
        email: updatedUser.email || "",
        idNumber: updatedUser.idNumber || "",
        avatarUrl: updatedUser.avatarUrl || "",
      });
      setMessage("Profile updated successfully.");
    } catch (error) {
      setMessage(error.message || "Unable to update your profile.");
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();
    setMessage("");
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessage("New passwords do not match.");
      return;
    }
    try {
      await changePassword(passwordForm);
      setPasswordForm(emptyPassword);
      setMessage("Password changed successfully.");
    } catch (error) {
      setMessage(error.message || "Unable to change password.");
    }
  }

  return (
    <div className="app-user-menu-wrap">
      <button
        type="button"
        className="app-user-trigger"
        aria-expanded={isOpen}
        aria-label={`Open profile menu for ${user.firstName} ${user.lastName}`}
        onClick={() => setIsOpen((open) => !open)}
      >
        <UserAvatar user={user} initials={initials} className="app-user-avatar" />
        <span className="app-user-copy">
          <strong>{user.firstName} {user.lastName}</strong>
          <small>{user.email}</small>
        </span>
        <span className="app-user-chevron" aria-hidden="true">&#9662;</span>
      </button>

      {isOpen ? (
        <div className="app-user-dropdown">
          <button type="button" onClick={openProfileDetails}>My profile</button>
          {user.role === "admin" ? <Link to="/admin" onClick={() => setIsOpen(false)}>Admin</Link> : null}
          <button type="button" className="app-user-logout" onClick={logout}>Log out</button>
        </div>
      ) : null}

      {isDetailsOpen ? (
        <div className="app-profile-panel">
          <div className="app-profile-header">
            <AvatarPicker
              user={{ ...user, avatarUrl: profileForm.avatarUrl || user.avatarUrl }}
              initials={initials}
              onChange={(avatarUrl) => setProfileForm((current) => ({ ...current, avatarUrl }))}
              className="app-profile-avatar"
            />
            <div>
              <strong>{user.firstName} {user.lastName}</strong>
              <small>{user.email}</small>
            </div>
          </div>

          <form className="app-profile-form" onSubmit={handleProfileSubmit}>
            <div className="app-profile-row">
              <div><span>First name</span><strong>{user.firstName}</strong></div>
              <div><span>Last name</span><strong>{user.lastName}</strong></div>
            </div>
            <div className="app-profile-row">
              <div><span>Email</span><strong>{user.email}</strong></div>
              <div><span>ID number</span><strong>{user.idNumber}</strong></div>
            </div>
            <button type="submit" className="app-profile-submit">Update profile</button>
          </form>

          <div className="app-profile-form">
            <button
              type="button"
              className="app-profile-submit"
              onClick={() => { setIsPasswordOpen((open) => !open); setMessage(""); }}
            >
              {isPasswordOpen ? "Cancel password change" : "Change password"}
            </button>
          </div>

          {isPasswordOpen ? (
            <form className="app-profile-form" onSubmit={handlePasswordSubmit}>
              <label><span>Current password</span><input type="password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))} required /></label>
              <label><span>New password</span><input type="password" value={passwordForm.newPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))} minLength="6" required /></label>
              <label><span>Confirm new password</span><input type="password" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))} minLength="6" required /></label>
              <button type="submit" className="app-profile-submit">Save password</button>
            </form>
          ) : null}

          {message ? <p className="app-profile-message">{message}</p> : null}
          <button type="button" className="app-profile-close" onClick={() => setIsDetailsOpen(false)}>Close</button>
        </div>
      ) : null}
    </div>
  );
}

export default UserMenu;