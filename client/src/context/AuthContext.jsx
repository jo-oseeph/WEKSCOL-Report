import React, { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const AuthContext = createContext(null);

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, { credentials: "include", headers: { "Content-Type": "application/json" }, ...options });
  } catch {
    throw new Error("Authentication server is not running. Start it with: npm --prefix server start");
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Unable to complete the request.");
  return body;
}

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    request("/auth/me").then(({ user: currentUser }) => setUser(currentUser)).catch(() => setUser(null)).finally(() => setIsLoading(false));
  }, []);

  async function login(credentials) {
    const result = await request("/auth/login", { method: "POST", body: JSON.stringify(credentials) });
    setUser(result.user);
    navigate("/reports");
  }

  async function register(details) {
    return request("/auth/register", { method: "POST", body: JSON.stringify(details) });
  }

  async function updateProfile(details) {
    const result = await request("/auth/profile", {
      method: "PUT",
      body: JSON.stringify(details),
    });
    setUser(result.user);
    return result.user;
  }

  async function changePassword(details) {
    return request("/auth/password", {
      method: "PUT",
      body: JSON.stringify(details),
    });
  }

  async function requestPasswordReset(email) {
    return request("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }

  async function resetPassword(details) {
    return request("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(details),
    });
  }

  async function logout() {
    await request("/auth/logout", { method: "POST" });
    setUser(null);
    navigate("/");
  }

  return <AuthContext.Provider value={{ user, isLoading, login, register, updateProfile, changePassword, requestPasswordReset, resetPassword, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
