import React, { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../api/api.js";

const AuthContext = createContext(null);

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

  async function logout() {
    await auth.logout();
    setUser(null);
    navigate("/");
  }

  return <AuthContext.Provider value={{ user, isLoading, login, register, updateProfile, changePassword, requestPasswordReset, resetPassword, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
