import React, { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ethers } from 'ethers';
import Home from './pages/Home.jsx';
import ProductDetails from './pages/ProductDetails.jsx';
import AddProduct from './pages/AddProduct.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Navbar from './components/Navbar.jsx';

export default function App() {
  const [account, setAccount] = useState('');
  const [chainId, setChainId] = useState(null);
  const [msg, setMsg] = useState('');

  const connectWallet = async () => {
    try {
      if (!window.ethereum) { setMsg('Install MetaMask'); return; }
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const addr = await signer.getAddress();
      const net = await provider.getNetwork();
      setAccount(addr);
      setChainId(Number(net.chainId));
    } catch (e) { setMsg(e.message); }
  };

  const switchToGanache = async () => {
    try {
      if (!window.ethereum) return;
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x539' }], // 1337
      });
    } catch (switchError) {
      setMsg(switchError.message);
    }
  };

  useEffect(() => {
    if (!window.ethereum) return;
    const handlerAccounts = (accs) => { setAccount(accs && accs[0] ? accs[0] : ''); };
    const handlerChain = (_chainId) => { setChainId(parseInt(_chainId, 16)); };
    window.ethereum.request({ method: 'eth_accounts' }).then((accs) => handlerAccounts(accs));
    window.ethereum.request({ method: 'eth_chainId' }).then((id) => handlerChain(id));
    window.ethereum.on('accountsChanged', handlerAccounts);
    window.ethereum.on('chainChanged', handlerChain);
    return () => {
      window.ethereum.removeListener('accountsChanged', handlerAccounts);
      window.ethereum.removeListener('chainChanged', handlerChain);
    };
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4">
      <Navbar 
        account={account} 
        chainId={chainId} 
        onConnect={connectWallet} 
        onSwitch={switchToGanache} 
      />
      <Routes>
        <Route path="/" element={<Home account={account} />} />
        <Route path="/add" element={<AddProduct account={account} />} />
        <Route path="/product/:id" element={<ProductDetails account={account} />} />
        <Route path="/dashboard" element={<Dashboard account={account} />} />
      </Routes>
      {msg && <div className="mt-3 text-red-700">{msg}</div>}
    </div>
  );
}
