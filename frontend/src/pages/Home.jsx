import React, { useEffect, useState } from "react";
import ProductCard from "../components/ProductCard";
import { initContract, listProduct } from "../utils/contract";

export default function Home() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    async function load() {
      const contract = await initContract();
      let productCount = await contract.productCount();
      let items = [];
      for (let i = 1; i <= productCount; i++) {
        let p = await contract.products(i);
        items.push({ id: p.id.toString(), name: p.name, price: p.price.toString() });
      }
      setProducts(items);
    }
    load();
  }, []);

  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
