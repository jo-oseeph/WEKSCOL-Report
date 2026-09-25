import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import "../styles/Hero.css";

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { resetPassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const token = searchParams.get("token") || "";

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);
    try {
      const result = await resetPassword({
        token,
        newPassword: password,
        confirmPassword,
      });
      setMessage(result.message);
      setPassword("");
      setConfirmPassword("");
      window.setTimeout(() => navigate("/"), 1600);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-page recovery-page">
      <section className="auth-panel recovery-panel">
        <div className="auth-panel-inner">
          <div className="auth-header">
            <h1 className="auth-title">Set a new password</h1>
            <p className="recovery-description">
              Choose a new password with at least 6 characters.
            </p>
          </div>
          {token ? (
            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="auth-field">
                <label htmlFor="reset-password">New password</label>
                <input
                  id="reset-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="New password"
                  minLength={6}
                  required
                />
              </div>
              <div className="auth-field">
                <label htmlFor="reset-confirm-password">Confirm new password</label>
                <input
                  id="reset-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirm new password"
                  minLength={6}
                  required
                />
              </div>
              {error ? <p className="auth-error">{error}</p> : null}
              {message ? <p className="auth-success">{message}</p> : null}
              <button className="auth-submit" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Resetting password..." : "Reset password"}
              </button>
            </form>
          ) : (
            <p className="auth-error">This password reset link is missing or invalid.</p>
          )}
          <p className="auth-toggle">
            <Link className="auth-link-quiet" to="/">Back to sign in</Link>
          </p>
        </div>
      </section>
    </main>
  );
}

export default ResetPassword;