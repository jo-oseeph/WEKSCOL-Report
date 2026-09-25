import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import "../styles/Hero.css";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { requestPasswordReset } = useAuth();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);
    try {
      const result = await requestPasswordReset(email);
      setMessage(result.message);
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
            <h1 className="auth-title">Forgot password?</h1>
            <p className="recovery-description">
              Enter your account email and we&apos;ll send a secure reset link if the account exists.
            </p>
          </div>
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-field">
              <label htmlFor="forgot-email">Email address</label>
              <input
                id="forgot-email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email address"
                required
              />
            </div>
            {error ? <p className="auth-error">{error}</p> : null}
            {message ? <p className="auth-success">{message}</p> : null}
            <button className="auth-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Sending link..." : "Send reset link"}
            </button>
          </form>
          <p className="auth-toggle">
            <Link className="auth-link-quiet" to="/">Back to sign in</Link>
          </p>
        </div>
      </section>
    </main>
  );
}

export default ForgotPassword;