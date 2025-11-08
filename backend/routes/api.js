import express from 'express';
import Web3 from 'web3';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Setup web3 connection to local Ganache
const providerUrl = process.env.WEB3_PROVIDER || 'http://127.0.0.1:7545';
const web3 = new Web3(new Web3.providers.HttpProvider(providerUrl));

// Load contract ABI and address from Truffle build artifacts if present
const artifactPath = path.resolve(process.cwd(), '../build/contracts/ReviewSystem.json');
let contract;
let defaultAccount;
try {
  const artifact = JSON.parse(fs.readFileSync(artifactPath));
  const networkId = Object.keys(artifact.networks)[0];
  const address = artifact.networks[networkId].address;
  const abi = artifact.abi;
  contract = new web3.eth.Contract(abi, address);
} catch (e) {
  console.warn('Contract artifact not found. Make sure to run truffle migrate.', e.message);
}

web3.eth.getAccounts().then((accounts) => { defaultAccount = accounts[0]; }).catch(() => {});

// Models for Mongo (very minimal demo)
import mongoose from 'mongoose';
let User;
try {
  const UserSchema = new mongoose.Schema({ address: String, name: String });
  User = mongoose.model('User', UserSchema);
} catch (e) {
  // Mongo may be skipped; ignore
}

router.get('/products', async (req, res) => {
  try {
    if (!contract) return res.status(500).json({ error: 'Contract not loaded' });
    const nextId = await contract.methods.nextProductId().call();
    const end = Number(nextId) - 1;
    if (end < 1) return res.json([]);
    const list = await contract.methods.getProducts(1, end).call();
    res.json(list.filter(p => p.exists));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/products', async (req, res) => {
  try {
    const { name, priceWei, from } = req.body;
    const sender = from || defaultAccount;
    const receipt = await contract.methods.listProduct(name, priceWei).send({ from: sender });
    res.json({ tx: receipt.transactionHash });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/purchase', async (req, res) => {
  try {
    const { productId, valueWei, from } = req.body;
    const sender = from || defaultAccount;
    const receipt = await contract.methods.purchaseProduct(productId).send({ from: sender, value: valueWei });
    res.json({ tx: receipt.transactionHash });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/review', async (req, res) => {
  try {
    const { productId, rating, comment, stakeWei, from } = req.body;
    const sender = from || defaultAccount;
    const receipt = await contract.methods.postReview(productId, rating, comment).send({ from: sender, value: stakeWei });
    res.json({ tx: receipt.transactionHash });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/helpful', async (req, res) => {
  try {
    const { productId, reviewId, from } = req.body;
    const sender = from || defaultAccount;
    const receipt = await contract.methods.giveHelpfulScore(productId, reviewId).send({ from: sender });
    res.json({ tx: receipt.transactionHash });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/challenge', async (req, res) => {
  try {
    // const { productId, reviewId, stakeWei, from } = req.body;
    const { productId, reviewId, stakeWei, from } = req.body;
    const reviewIndex = Number(reviewId) - 1;
    const sender = from || defaultAccount;
    // const receipt = await contract.methods.challengeReview(productId, reviewId).send({ from: sender, value: stakeWei });
    const receipt = await contract.methods.challengeReview(productId, reviewIndex).send({ from: sender, value: stakeWei });
    res.json({ tx: receipt.transactionHash });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/vote', async (req, res) => {
  try {
    const { productId, reviewId, supports, stakeWei, from } = req.body;
    const reviewIndex = Number(reviewId) - 1;
    const sender = from || defaultAccount;
    const receipt = await contract.methods.voteOnChallenge(productId, reviewIndex, supports).send({ from: sender, value: stakeWei });
    res.json({ tx: receipt.transactionHash });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/reviews/:productId', async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    const ids = await contract.methods.getProductReviewIds(productId).call();
    const reviews = await Promise.all(ids.map(async (rid) => {
      const r = await contract.methods.getReview(productId, rid).call();
      return {
        id: Number(r[0]),
        reviewer: r[1],
        rating: Number(r[2]),
        comment: r[3],
        stakeWei: r[4].toString(),
        helpfulCount: Number(r[5]),
        challenged: r[6],
        removed: r[7]
      };
    }));
    res.json(reviews);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;


