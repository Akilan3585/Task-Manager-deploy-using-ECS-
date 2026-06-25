// Routes.js – fixed for React Router v6+
import React from "react";
import { Routes, Route } from "react-router-dom";
import Home from "./Home";
import Student from "./Student"; // repurposed as Tasks UI

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/tasks" element={<Student />} />
    </Routes>
  );
}
