import React, { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import httpClient from "../api/httpClient.js";

const AuthContext = createContext(null);

async function request(path, { method = "GET", body } = {}) {
  try {
    const response = await httpClient.request({ url: path, method, data: body });
    return response.data;
  } catch (error) {
    if (!error.response) {
      throw new Error("Authentication server is not running. Start it with: npm --prefix server start");
    }
    throw new Error(error.response.data?.error || "Unable to complete the request.");
  }
}

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    request("/auth/me").then(({ user: currentUser }) => setUser(currentUser)).catch(() => setUser(null)).finally(() => setIsLoading(false));
  }, []);

  async function login(credentials) {
    const result = await request("/auth/login", { method: "POST", body: credentials });
    setUser(result.user);
    navigate("/reports");
  }

  async function register(details) {
    return request("/auth/register", { method: "POST", body: details });
  }

  async function updateProfile(details) {
    const result = await request("/auth/profile", {
      method: "PUT",
      body: details,
    });
    setUser(result.user);
    return result.user;
  }

  async function changePassword(details) {
    return request("/auth/password", {
      method: "PUT",
      body: details,
    });
  }

  async function requestPasswordReset(email) {
    return request("/auth/forgot-password", {
      method: "POST",
      body: { email },
    });
  }

  async function resetPassword(details) {
    return request("/auth/reset-password", {
      method: "POST",
      body: details,
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
