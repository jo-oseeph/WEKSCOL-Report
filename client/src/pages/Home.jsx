import Hero from "../components/Hero.jsx";
import AppNavbar from "../components/AppNavbar.jsx";
import "../styles/Site.css";
import "../styles/CategoryTabs.css";

function Home() {
  return (
    <div className="site-shell">
      <AppNavbar />
      <Hero />
    </div>
  );
}

export default Home;