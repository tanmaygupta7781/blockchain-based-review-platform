import React from "react";
import { Link } from "react-router-dom";

export default function ProductCard({ product }) {
  return (
    <div className="p-4 rounded-xl shadow bg-white">
      <h2 className="text-lg font-semibold">{product.name}</h2>
      <p className="text-sm text-gray-600">Price: {product.price} wei</p>
      <Link
        to={`/product/${product.id}`}
        className="mt-3 inline-block px-3 py-2 bg-blue-600 text-white rounded-lg"
      >
        View Details
      </Link>
    </div>
  );
}
