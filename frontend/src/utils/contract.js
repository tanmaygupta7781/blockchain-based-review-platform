import { ethers } from "ethers";
import ReviewSystemABI from "../abi/ReviewSystem.json"; // generated after truffle compile

// Update this with your deployed contract address from truffle migrate
const CONTRACT_ADDRESS = "0xB89C17F10A449Fbc18fB779Ff725a44585abb6BF";

let contract;
let signer;
let provider;

export async function initContract() {
  if (window.ethereum) {
    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    contract = new ethers.Contract(CONTRACT_ADDRESS, ReviewSystemABI.abi, signer);
    return contract;
  } else {
    throw new Error("MetaMask not detected");
  }
}

// ---------- Contract Calls ----------
export async function getRole(address) {
  return await contract.roles(address);
}

export async function hasPurchased(productId, address) {
  return await contract.hasPurchased(productId, address);
}

export async function listProduct(name, priceWei) {
  const tx = await contract.listProduct(name, priceWei);
  return tx.wait();
}

export async function purchaseProduct(productId, priceWei) {
  const tx = await contract.purchaseProduct(productId, { value: priceWei });
  return tx.wait();
}

export async function postReview(productId, content, stakeWei) {
  const tx = await contract.postReview(productId, content, { value: stakeWei });
  return tx.wait();
}

export async function giveHelpfulScore(productId, reviewIndex) {
  const tx = await contract.giveHelpfulScore(productId, reviewIndex);
  return tx.wait();
}

export async function challengeReview(productId, reviewIndex, stakeWei) {
  const tx = await contract.challengeReview(productId, reviewIndex, { value: stakeWei });
  return tx.wait();
}

export async function voteOnChallenge(productId, reviewIndex, agree, stakeWei) {
  const tx = await contract.voteOnChallenge(productId, reviewIndex, agree, { value: stakeWei });
  return tx.wait();
}

export async function finalizeChallenge(productId, reviewIndex) {
  const tx = await contract.finalizeChallenge(productId, reviewIndex-1);
  return tx.wait();
}

// ---------- Read Helpers ----------
export async function getReviews(productId) {
  return await contract.getReviews(productId);
}

export async function getChallenge(productId, reviewIndex) {
  return await contract.getChallenge(productId, reviewIndex);
}
