import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Reports from "./pages/Reports.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import AdminLayout from "./pages/admin/AdminLayout.jsx";
import AdminOverview from "./pages/admin/AdminOverview.jsx";
import AdminUsers from "./pages/admin/AdminUsers.jsx";
import AdminAccess from "./pages/admin/AdminAccess.jsx";
import AdminCatalog from "./pages/admin/AdminCatalog.jsx";
import AdminActivity from "./pages/admin/AdminActivity.jsx";
import AdminRoute from "./components/AdminRoute.jsx";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/reports" element={<Reports />} />
        <Route path="/dashboard" element={<Reports />} />
        <Route path="/reports/:categoryId/:subcategoryId/:groupId/:reportId" element={<Reports />} />
        <Route path="/:categoryId/:subcategoryId/:groupId/:reportId" element={<Reports />} />
        <Route path="/reports/:categoryId/:subcategoryId/:reportId" element={<Reports />} />
        <Route path="/:categoryId/:subcategoryId/:reportId" element={<Reports />} />
      </Route>
      <Route element={<AdminRoute />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminOverview />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="access" element={<AdminAccess />} />
          <Route path="catalog" element={<AdminCatalog />} />
          <Route path="activity" element={<AdminActivity />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;