import React, { useEffect, useRef, useState } from "react";
import LoginForm from "./LoginForm.jsx";
import RegisterForm from "./RegisterForm.jsx";
import "../styles/Hero.css";

const heroSlides = [
  {
    url: "/images/auth-slide-1.jpg",
    alt: "Sugarcane field and processing environment",
    eyebrow: "Field intelligence",
    title: "See the season clearly",
    description: "Track sugarcane operations, field performance and crop progress from one secure reporting space.",
    stats: [
      { value: "38+", label: "Live reports" },
      { value: "6", label: "Operational areas" },
      { value: "24/7", label: "Access" },
    ],
  },
  {
    url: "/images/auth-slide-2.jpg",
    alt: "Harvested sugarcane in the field",
    eyebrow: "Harvest visibility",
    title: "Turn harvest data into action",
    description: "Follow harvested cane, field readiness and delivery movement before the next decision is due.",
    stats: [
      { value: "3", label: "Plants" },
      { value: "9", label: "Regions" },
      { value: "72", label: "Zones" },
    ],
  },
  {
    url: "/images/auth-slide-3.jpg",
    alt: "Operational sugar production facilities",
    eyebrow: "Factory operations",
    title: "Connect field to factory",
    description: "Bring production, quality and supply information together for a sharper view of the operation.",
    stats: [
      { value: "126K", label: "Est. tons" },
      { value: "10.1", label: "Tons / hectare" },
      { value: "68%", label: "Readiness" },
    ],
  },
  {
    url: "/images/auth-slide-4.jpg",
    alt: "Field and transport scene in the sugar estate",
    eyebrow: "Cane logistics",
    title: "Keep every movement in view",
    description: "Monitor haulage, deliveries and field-to-factory flow with reports built for daily operations.",
    stats: [
      { value: "84K", label: "Tons delivered" },
      { value: "2.8K", label: "Active fields" },
      { value: "6", label: "Location levels" },
    ],
  },
  {
    url: "/images/auth-slide-5.jpg",
    alt: "Additional sugar industry image",
    eyebrow: "Grower insight",
    title: "Make every field count",
    description: "Surface grower, planting and field information that helps teams plan with confidence.",
    stats: [
      { value: "12.4K", label: "Hectares" },
      { value: "8.9K", label: "Planted ha" },
      { value: "214", label: "New fields" },
    ],
  },
  {
    url: "/images/auth-slide-6.jpg",
    alt: "Additional field and transport view",
    eyebrow: "Operational control",
    title: "Find the signal faster",
    description: "Move from broad operational summaries to the exact plant, region, zone or village you need.",
    stats: [
      { value: "6", label: "Filter levels" },
      { value: "1", label: "Secure portal" },
      { value: "0", label: "Lost context" },
    ],
  },
  {
    url: "/images/auth-slide-7.jpg",
    alt: "Additional sugar estate landscape",
    eyebrow: "Reports portal",
    title: "A clearer view of what is next",
    description: "Access departmental reporting in one modern workspace designed for confident decisions.",
    stats: [
      { value: "38+", label: "Reports" },
      { value: "6", label: "Departments" },
      { value: "1", label: "Workspace" },
    ],
  },
];

function Hero() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [mode, setMode] = useState("login");
  const [registerSuccessMessage, setRegisterSuccessMessage] = useState("");
  const [prefillUsername, setPrefillUsername] = useState("");
  const formRef = useRef(null);
  const activeSlideContent = heroSlides[activeSlide];

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % heroSlides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const switchMode = (next) => {
    if (next === mode) return;
    setMode(next);
    setRegisterSuccessMessage("");
  };

  // Moves the user to the login form, pre-filled, after a successful registration.
  function handleRegistered(registeredEmail) {
    setPrefillUsername(registeredEmail);
    setMode("login");
    setRegisterSuccessMessage(
      "Account created. Your account is awaiting administrator approval before you can sign in.",
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-visual">
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

        <div className="auth-copy" key={activeSlide}>
          <span className="auth-eyebrow">{activeSlideContent.eyebrow}</span>
          <h1 className="auth-heading">{activeSlideContent.title}</h1>
          <p className="auth-desc">{activeSlideContent.description}</p>

          <div className="auth-stats">
            {activeSlideContent.stats.map((stat) => (
              <div className="auth-stat" key={stat.label}>
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            ))}
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
              <LoginForm
                successMessage={registerSuccessMessage}
                onSuccessMessageClear={() => setRegisterSuccessMessage("")}
                prefillUsername={prefillUsername}
              />
            ) : (
              <RegisterForm onRegistered={handleRegistered} />
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