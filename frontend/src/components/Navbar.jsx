import React from "react";
import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <nav className="flex justify-between items-center p-4 bg-gray-900 text-white">
      <h1 className="text-xl font-bold">Blockchain Review System</h1>
      <div className="space-x-4">
        <Link to="/">Home</Link>
        <Link to="/add">Add Product</Link>
        <Link to="/dashboard">Dashboard</Link>
      </div>
    </nav>
  );
}
