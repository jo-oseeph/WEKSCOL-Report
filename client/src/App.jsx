import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Reports from "./pages/Reports.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/reports" element={<Reports />} />
        <Route path="/dashboard" element={<Reports />} />
        <Route path="/reports/:categoryId/:subcategoryId/:reportId" element={<Reports />} />
        <Route path="/:categoryId/:subcategoryId/:reportId" element={<Reports />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;