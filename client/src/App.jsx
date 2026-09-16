import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Reports from "./pages/Reports.jsx";
// import Login from "./pages/Login.jsx";
// import Register from "./pages/Register.jsx";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      {/* <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} /> */}
      <Route path="/reports" element={<Reports />} />
      <Route path="/dashboard" element={<Reports />} />
      <Route path="/reports/:categoryId/:subcategoryId/:reportId" element={<Reports />} />
      <Route path="/:categoryId/:subcategoryId/:reportId" element={<Reports />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;