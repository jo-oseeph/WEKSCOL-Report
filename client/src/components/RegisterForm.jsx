import React, { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";

// Default (empty) shape of the registration form fields.
const initialRegister = {
  firstName: "",
  lastName: "",
  email: "",
  idNumber: "",
  password: "",
  confirmPassword: "",
};

// Self-contained registration form: owns its own field state and submit
// handling. On success it hands the new account's email back to the caller
// (via onRegistered) so the parent can switch to the login form pre-filled.
function RegisterForm({ onRegistered }) {
  // Current values of the registration form's inputs.
  const [register, setRegister] = useState(initialRegister);
  // Server/validation error to show under the form, if any.
  const [error, setError] = useState("");
  // Disables the submit button while the registration request is in flight.
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register: createAccount } = useAuth();

  // Updates a single field as the user types.
  function handleChange(event) {
    setRegister((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  }

  // Creates the account and, on success, resets the form and notifies the parent.
  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await createAccount(register);
      const registeredEmail = register.email;
      setRegister(initialRegister);
      onRegistered?.(registeredEmail);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <div className="auth-inline-grid">
        <div className="auth-field">
          <input
            id="firstName"
            name="firstName"
            type="text"
            autoComplete="given-name"
            value={register.firstName}
            onChange={handleChange}
            placeholder="First name"
            required
          />
        </div>

        <div className="auth-field">
          <input
            id="lastName"
            name="lastName"
            type="text"
            autoComplete="family-name"
            value={register.lastName}
            onChange={handleChange}
            placeholder="Last name"
            required
          />
        </div>
      </div>

      <div className="auth-field">
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={register.email}
          onChange={handleChange}
          placeholder="Email address"
          required
        />
      </div>

      <div className="auth-field">
        <input
          id="idNumber"
          name="idNumber"
          type="text"
          autoComplete="off"
          value={register.idNumber}
          onChange={handleChange}
          placeholder="ID number"
          required
        />
      </div>

      <div className="auth-field">
        <input
          id="reg-password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={register.password}
          onChange={handleChange}
          placeholder="Password"
          required
        />
      </div>

      {error ? <p className="auth-error">{error}</p> : null}
      <button className="auth-submit" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating account..." : "Create account"}
      </button>
    </form>
  );
}

export default RegisterForm;
