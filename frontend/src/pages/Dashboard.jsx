import React, { useEffect, useState } from "react";
import { initContract } from "../utils/contract";

export default function Dashboard() {
  const [role, setRole] = useState("");

  useEffect(() => {
    async function load() {
      const contract = await initContract();
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const r = await contract.roles(accounts[0]);
      setRole(r.toString() === "0" ? "Customer" : "Seller");
    }
    load();
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold">Dashboard</h2>
      <p className="mt-2">Current Role: {role}</p>
    </div>
  );
}
