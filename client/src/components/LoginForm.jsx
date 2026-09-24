import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";


const initialLogin = { username: "", password: "" };
function LoginForm({ successMessage, onSuccessMessageClear, prefillUsername = "" }) {
  const [login, setLogin] = useState({ ...initialLogin, username: prefillUsername });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, login: authenticate } = useAuth();

  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setLogin(initialLogin);
  }, [user]);

  function handleChange(event) {
    setLogin((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  }

  // Submits the credentials and surfaces any error returned by the API.
  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    onSuccessMessageClear?.();
    setIsSubmitting(true);
    try {
      await authenticate({ email: login.username, password: login.password });
      setLogin(initialLogin);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="auth-form" autoComplete="off" onSubmit={handleSubmit}>
      <div className="auth-field">
        <label htmlFor="username">Username</label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="off"
          value={login.username}
          onChange={handleChange}
          placeholder="Username"
          required
        />
      </div>

      <div className="auth-field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={login.password}
          onChange={handleChange}
          placeholder="Password"
          required
        />
      </div>

      <div className="auth-row">
        <Link className="auth-link-quiet" to="/forgot-password">
          Forgot password?
        </Link>
      </div>

      {error ? <p className="auth-error">{error}</p> : null}
      {successMessage ? <p className="auth-success">{successMessage}</p> : null}
      <button className="auth-submit" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}

export default LoginForm;
