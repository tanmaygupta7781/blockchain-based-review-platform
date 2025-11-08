import React, { useState } from "react";
import { listProduct } from "../utils/contract";

export default function AddProduct() {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    await listProduct(name, price);
    alert("Product added!");
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">Add Product</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          className="border p-2 w-full"
          placeholder="Product name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="border p-2 w-full"
          placeholder="Price in wei"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <button className="px-4 py-2 bg-blue-600 text-white rounded">Add</button>
      </form>
    </div>
  );
}
