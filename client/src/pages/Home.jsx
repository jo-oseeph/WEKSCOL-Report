import React from "react";
import { Link } from "react-router-dom";
import Hero from "../components/Hero.jsx";
import "../styles/Site.css";

function Home() {
  return (
    <div className="site-shell">
      <header className="site-topbar">
        <Link className="site-brand" to="/">
          {/* <span className="site-logo">WK</span> */}
          <span className="site-brand-copy">
            <strong>WEKSCOL Report</strong>
            <small>West Kenya Sugar Co.</small>
          </span>
        </Link>
        <nav className="site-nav" aria-label="Main navigation">
          <Link className="site-nav-link active" to="/">Home</Link>
          <Link className="site-nav-link" to="/reports">Reports</Link>
        </nav>
      </header>
      <Hero />
    </div>
  );
}

export default Home;