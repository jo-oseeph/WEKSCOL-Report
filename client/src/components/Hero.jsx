import React, { useEffect, useRef, useState } from "react";
import { reportCategories } from "../data/reportsData";
import { useAuth } from "../context/AuthContext.jsx";
import "../styles/Hero.css";

const heroSlides = [
  {
    url: "/images/auth-slide-1.jpg",
    alt: "Sugarcane field and processing environment",
  },
  {
    url: "/images/auth-slide-2.jpg",
    alt: "Harvested sugarcane in the field",
  },
  {
    url: "/images/auth-slide-3.jpg",
    alt: "Operational sugar production facilities",
  },
  {
    url: "/images/auth-slide-4.jpg",
    alt: "Field and transport scene in the sugar estate",
  },
  {
    url: "/images/auth-slide-5.jpg",
    alt: "Additional sugar industry image",
  },
  {
    url: "/images/auth-slide-6.jpg",
    alt: "Additional field and transport view",
  },
  {
    url: "/images/auth-slide-7.jpg",
    alt: "Additional sugar estate landscape",
  },
];

const initialLogin = { username: "", password: "" };
const initialRegister = {
  firstName: "",
  lastName: "",
  email: "",
  idNumber: "",
  password: "",
  confirmPassword: "",
};

function Hero() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [login, setLogin] = useState(initialLogin);
  const [register, setRegister] = useState(initialRegister);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login: authenticate, register: createAccount } = useAuth();
  const formRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % heroSlides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const totalReports = reportCategories.reduce(
    (total, category) =>
      total +
      category.subcategories.reduce(
        (categoryTotal, subcategory) => categoryTotal + subcategory.reports.length,
        0
      ),
    0
  );
  const totalCategories = reportCategories.length;
  const totalSubcategories = reportCategories.reduce(
    (total, category) => total + category.subcategories.length,
    0
  );

  const switchMode = (next) => {
    if (next === mode) return;
    setMode(next);
    setError("");
    setSuccess("");
  };

  const handleLoginChange = (e) =>
    setLogin((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleRegisterChange = (e) =>
    setRegister((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);
    try {
      await authenticate({ email: login.username, password: login.password });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);
    try {
      await createAccount(register);
      setLogin({ username: register.email, password: "" });
      setRegister(initialRegister);
      setMode("login");
      setSuccess("Account created. Sign in to access the reports.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-visual" aria-hidden="true">
        <div className="auth-slides">
          {heroSlides.map((slide, index) => (
            <div
              key={slide.url}
              className={
                "auth-slide" + (index === activeSlide ? " auth-slide-active" : "")
              }
              style={{ backgroundImage: `url(${slide.url})` }}
            />
          ))}
        </div>
        <div className="auth-visual-overlay" />

        <div className="auth-copy">
          <span className="auth-eyebrow">West Kenya Sugar Co.</span>
          <h1 className="auth-heading">Reports Portal</h1>
          <p className="auth-desc">
            Track sugarcane operations and access every departmental report
            from one secure dashboard.
          </p>

          <div className="auth-stats">
            <div className="auth-stat">
              <strong>{totalReports}</strong>
              <span>Reports</span>
            </div>
            <div className="auth-stat">
              <strong>{totalCategories}</strong>
              <span>Categories</span>
            </div>
            <div className="auth-stat">
              <strong>{totalSubcategories}</strong>
              <span>Subcategories</span>
            </div>
          </div>
        </div>

        <div className="auth-slide-dots">
          {heroSlides.map((slide, index) => (
            <span
              key={slide.url}
              className={
                "auth-dot" + (index === activeSlide ? " auth-dot-active" : "")
              }
            />
          ))}
        </div>
      </section>

      <section className="auth-panel" id="auth-panel">
        <div className="auth-panel-inner">
          <div className="auth-header">
            <h1 className="auth-title">
              {mode === "login" ? "Sign in" : "Create account"}
            </h1>
          </div>

          <div key={mode} className="auth-form-wrap" ref={formRef}>
            {mode === "login" ? (
              <form className="auth-form" onSubmit={handleLoginSubmit}>
                <div className="auth-field">
                  <label htmlFor="username">Username</label>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    value={login.username}
                    onChange={handleLoginChange}
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
                    autoComplete="current-password"
                    value={login.password}
                    onChange={handleLoginChange}
                    placeholder="Password"
                    required
                  />
                </div>

                <div className="auth-row">
                  <a className="auth-link-quiet" href="/forgot-password">
                    Forgot password?
                  </a>
                </div>

                {error ? <p className="auth-error">{error}</p> : null}
                {success ? <p className="auth-success">{success}</p> : null}
                <button className="auth-submit" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Signing in..." : "Sign in"}
                </button>
              </form>
            ) : (
              <form className="auth-form" onSubmit={handleRegisterSubmit}>
                <div className="auth-inline-grid">
                  <div className="auth-field">
                    <input
                      id="firstName"
                      name="firstName"
                      type="text"
                      autoComplete="given-name"
                      value={register.firstName}
                      onChange={handleRegisterChange}
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
                      onChange={handleRegisterChange}
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
                    onChange={handleRegisterChange}
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
                    onChange={handleRegisterChange}
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
                    onChange={handleRegisterChange}
                    placeholder="Password"
                    required
                  />
                </div>

                {error ? <p className="auth-error">{error}</p> : null}
                <button className="auth-submit" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Creating account..." : "Create account"}
                </button>
              </form>
            )}
          </div>

          <p className="auth-toggle">
            {mode === "login" ? (
              <>
                No account?{" "}
                <button type="button" onClick={() => switchMode("register")}>
                  Register
                </button>
              </>
            ) : (
              <>
                Have an account?{" "}
                <button type="button" onClick={() => switchMode("login")}>
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </section>
    </main>
  );
}

export default Hero;