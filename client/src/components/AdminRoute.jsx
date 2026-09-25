import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

function AdminRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="auth-shell"><p className="auth-note">Checking your session...</p></div>;
  }

  if (!user) return <Navigate to="/" replace />;
  if (user.role !== "admin") return <Navigate to="/reports" replace />;

  return <Outlet />;
}

export default AdminRoute;