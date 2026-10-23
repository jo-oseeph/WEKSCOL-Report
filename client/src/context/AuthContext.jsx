import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../api/api.js";

const AuthContext = createContext(null);
const INACTIVITY_TIMEOUT_MS = 3 * 60 * 1000;

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    auth.getCurrentUser().then(({ user: currentUser }) => setUser(currentUser)).catch(() => setUser(null)).finally(() => setIsLoading(false));
  }, []);

  async function login(credentials) {
    const result = await auth.login(credentials);
    setUser(result.user);
    navigate("/reports");
  }

  async function register(details) {
    return auth.register(details);
  }

  async function updateProfile(details) {
    const result = await auth.updateProfile(details);
    setUser(result.user);
    return result.user;
  }

  async function changePassword(details) {
    return auth.changePassword(details);
  }

  async function requestPasswordReset(email) {
    return auth.requestPasswordReset(email);
  }

  async function resetPassword(details) {
    return auth.resetPassword(details);
  }

  const logout = useCallback(async () => {
    try {
      await auth.logout();
    } finally {
      setUser(null);
      navigate("/");
    }
  }, [navigate]);

  useEffect(() => {
    if (!user) return undefined;

    let inactivityTimer;
    const activityEvents = [
      "pointerdown",
      "pointermove",
      "keydown",
      "touchstart",
      "wheel",
      "scroll",
    ];

    const resetInactivityTimer = () => {
      window.clearTimeout(inactivityTimer);
      inactivityTimer = window.setTimeout(() => {
        void logout();
      }, INACTIVITY_TIMEOUT_MS);
    };

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, resetInactivityTimer, { passive: true });
    });
    resetInactivityTimer();

    return () => {
      window.clearTimeout(inactivityTimer);
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, resetInactivityTimer);
      });
    };
  }, [logout, user]);

  return <AuthContext.Provider value={{ user, isLoading, login, register, updateProfile, changePassword, requestPasswordReset, resetPassword, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
