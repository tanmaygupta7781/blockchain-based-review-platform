import express from 'express';
import Web3 from 'web3';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const router = express.Router();

// -------- Web3 / Contract wiring --------
const providerUrl = process.env.WEB3_PROVIDER || 'http://127.0.0.1:7545';
const web3 = new Web3(new Web3.providers.HttpProvider(providerUrl));

const artifactPath = path.resolve(process.cwd(), '../build/contracts/ReviewSystem.json');
let contract;
let defaultAccount;

(async () => {
  try {
    const artifact = JSON.parse(fs.readFileSync(artifactPath));
    // Use the actual connected network id for safety
    const netId = await web3.eth.net.getId();
    const network = artifact.networks?.[netId];
    if (!network || !network.address) {
      throw new Error(`ReviewSystem not deployed on network id ${netId}`);
    }
    contract = new web3.eth.Contract(artifact.abi, network.address);

    const accounts = await web3.eth.getAccounts();
    defaultAccount = accounts[0];
  } catch (e) {
    console.warn('Contract load error:', e.message);
  }
})().catch(() => {});

// -------- (Optional) Mongo demo model --------
let User;
try {
  const UserSchema = new mongoose.Schema({ address: String, name: String });
  User = mongoose.model('User', UserSchema);
} catch { /* ignore if no Mongo */ }

// -------- Helpers --------
function ensureContract(res) {
  if (!contract) {
    res.status(500).json({ error: 'Contract not loaded. Deploy and try again.' });
    return false;
  }
  return true;
}

function toReviewIndex(reviewId) {
  const idx = Number(reviewId) - 1;
  if (idx < 0) throw new Error('Invalid reviewId; must be >= 1');
  return idx;
}

// -------- Routes --------

// List products (iterate 1..productCount and read mapping)
router.get('/products', async (req, res) => {
  try {
    if (!ensureContract(res)) return;
    const count = Number(await contract.methods.productCount().call());
    if (count === 0) return res.json([]);

    const items = [];
    for (let id = 1; id <= count; id++) {
      const p = await contract.methods.products(id).call();
      if (p.exists) {
        items.push({
          id: Number(p.id),
          name: p.name,
          priceWei: p.price.toString(),
          seller: p.seller,
        });
      }
    }
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create product
router.post('/products', async (req, res) => {
  try {
    if (!ensureContract(res)) return;
    const { name, priceWei, from } = req.body;
    const sender = from || defaultAccount;
    const receipt = await contract.methods.listProduct(name, priceWei).send({ from: sender });
    res.json({ tx: receipt.transactionHash });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Purchase
router.post('/purchase', async (req, res) => {
  try {
    if (!ensureContract(res)) return;
    const { productId, valueWei, from } = req.body;
    const sender = from || defaultAccount;
    const receipt = await contract.methods.purchaseProduct(productId).send({ from: sender, value: valueWei });
    res.json({ tx: receipt.transactionHash });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Post review (contract takes: productId, content) — rating param removed
router.post('/review', async (req, res) => {
  try {
    if (!ensureContract(res)) return;
    const { productId, comment, stakeWei, from } = req.body;
    const sender = from || defaultAccount;
    const receipt = await contract.methods.postReview(productId, comment).send({ from: sender, value: stakeWei });
    res.json({ tx: receipt.transactionHash });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Mark helpful (convert 1-based reviewId -> 0-based index)
router.post('/helpful', async (req, res) => {
  try {
    if (!ensureContract(res)) return;
    const { productId, reviewId, from } = req.body;
    const reviewIndex = toReviewIndex(reviewId);
    const sender = from || defaultAccount;
    const receipt = await contract.methods.giveHelpfulScore(productId, reviewIndex).send({ from: sender });
    res.json({ tx: receipt.transactionHash });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Challenge review (convert id->index)
router.post('/challenge', async (req, res) => {
  try {
    if (!ensureContract(res)) return;
    const { productId, reviewId, stakeWei, from } = req.body;
    const reviewIndex = toReviewIndex(reviewId);
    const sender = from || defaultAccount;
    const receipt = await contract.methods.challengeReview(productId, reviewIndex).send({ from: sender, value: stakeWei });
    res.json({ tx: receipt.transactionHash });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Vote on challenge (convert id->index)
router.post('/vote', async (req, res) => {
  try {
    if (!ensureContract(res)) return;
    const { productId, reviewId, supports, stakeWei, from } = req.body;
    const reviewIndex = toReviewIndex(reviewId);
    const sender = from || defaultAccount;
    const receipt = await contract.methods.voteOnChallenge(productId, reviewIndex, supports).send({ from: sender, value: stakeWei });
    res.json({ tx: receipt.transactionHash });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Finalize challenge (convert id->index)
router.post('/finalize', async (req, res) => {
  try {
    if (!ensureContract(res)) return;
    const { productId, reviewId, from } = req.body;
    const reviewIndex = toReviewIndex(reviewId);
    const sender = from || defaultAccount;
    const receipt = await contract.methods.finalizeChallenge(productId, reviewIndex).send({ from: sender });
    res.json({ tx: receipt.transactionHash });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get all reviews for a product (contract returns array of Review)
router.get('/reviews/:productId', async (req, res) => {
  try {
    if (!ensureContract(res)) return;
    const productId = Number(req.params.productId);
    const list = await contract.methods.getReviews(productId).call();

    const reviews = list.map(r => ({
      id: Number(r.id),                 // 1-based id
      productId: Number(r.productId),
      reviewer: r.reviewer,
      comment: r.content,
      stakeWei: r.stake.toString(),
      helpfulCount: Number(r.helpfuls),
      challenged: r.challenged,
      removed: r.removed
    }));

    res.json(reviews);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Optional: expose basic challenge info for UI debugging
router.get('/challenge/:productId/:reviewId', async (req, res) => {
  try {
    if (!ensureContract(res)) return;
    const productId = Number(req.params.productId);
    const reviewIndex = toReviewIndex(Number(req.params.reviewId));
    const [exists, endTime, agreeStake, disagreeStake, settled] =
      await contract.methods.getChallenge(productId, reviewIndex).call();
    res.json({ exists, endTime: Number(endTime), agreeStake: agreeStake.toString(), disagreeStake: disagreeStake.toString(), settled });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
