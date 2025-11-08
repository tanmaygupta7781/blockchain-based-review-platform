import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import ReviewCard from "../components/ReviewCard";
import {
  initContract,
  purchaseProduct,
  postReview,
  giveHelpfulScore,
  challengeReview,
  voteOnChallenge,
  finalizeChallenge,
  getReviews,
  getChallenge,
  hasPurchased,
  getRole,
} from "../utils/contract";

export default function ProductDetails() {
  const { id } = useParams(); // productId from URL
  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [account, setAccount] = useState("");
  const [role, setRole] = useState("");
  const [reviewContent, setReviewContent] = useState("");
  const [stake, setStake] = useState("");

  useEffect(() => {
    async function load() {
      const contract = await initContract();
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      setAccount(accounts[0]);

      // Load role
      const r = await getRole(accounts[0]);
      setRole(r.toString() === "0" ? "Customer" : "Seller");

      // Load product info
      const p = await contract.products(id);
      setProduct({
        id: p.id.toString(),
        name: p.name,
        price: p.price.toString(),
        seller: p.seller,
      });

      // Load reviews
      await loadReviews();
    }
    load();
  }, [id]);

  async function loadReviews() {
    const reviewsList = await getReviews(id);
    const mapped = await Promise.all(
      reviewsList.map(async (r, i) => {
        const [exists, endTime, agreeStake, disagreeStake, settled] = await getChallenge(id, i);
        return {
          index: i,
          id: r.id.toString(),
          content: r.content,
          reviewer: r.reviewer,
          stake: r.stake,
          helpfuls: r.helpfuls,
          challenged: r.challenged,
          removed: r.removed,
          challenge: {
            exists,
            endTime: endTime.toString(),
            agreeStake: agreeStake.toString(),
            disagreeStake: disagreeStake.toString(),
            settled,
          },
        };
      })
    );
    setReviews(mapped);
  }

  async function handlePurchase() {
    await purchaseProduct(id, product.price);
    alert("Product purchased!");
  }

  async function handlePostReview() {
    if (!reviewContent || !stake) return alert("Content and stake required");
    await postReview(id, reviewContent, stake);
    setReviewContent("");
    setStake("");
    await loadReviews();
  }

  async function handleHelpful(i) {
    await giveHelpfulScore(id, i);
    await loadReviews();
  }

  async function handleChallenge(i) {
    const stakeVal = prompt("Enter stake (wei) greater than reviewer stake:");
    if (!stakeVal) return;
    await challengeReview(id, i, stakeVal);
    await loadReviews();
  }

  async function handleVote(i, agree) {
    const stakeVal = prompt("Enter stake (wei) for voting:");
    if (!stakeVal) return;
    await voteOnChallenge(id, i, agree, stakeVal);
    await loadReviews();
  }

  async function handleEnd(i) {
    await finalizeChallenge(id, i);
    await loadReviews();
  }

  return (
    <div className="p-6 space-y-6">
      {product && (
        <div className="p-4 rounded-xl shadow bg-white">
          <h2 className="text-xl font-semibold">{product.name}</h2>
          <p className="text-sm text-gray-600">Price: {product.price} wei</p>
          <p className="text-xs text-gray-500">Seller: {product.seller}</p>
          {role === "Customer" && (
            <button
              onClick={handlePurchase}
              className="mt-3 px-4 py-2 bg-blue-600 text-white rounded"
            >
              Purchase
            </button>
          )}
        </div>
      )}

      {role === "Customer" && (
        <div className="p-4 rounded-xl shadow bg-gray-50">
          <h3 className="text-lg font-semibold mb-2">Post a Review</h3>
          <textarea
            className="w-full border p-2 rounded"
            placeholder="Write your review..."
            value={reviewContent}
            onChange={(e) => setReviewContent(e.target.value)}
          />
          <input
            className="w-full border p-2 mt-2 rounded"
            placeholder="Stake in wei"
            value={stake}
            onChange={(e) => setStake(e.target.value)}
          />
          <button
            onClick={handlePostReview}
            className="mt-2 px-4 py-2 bg-green-600 text-white rounded"
          >
            Submit Review
          </button>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-xl font-semibold">Reviews</h3>
        {reviews.length === 0 && <p>No reviews yet.</p>}
        {reviews.map((r, i) => {
          const canVote =
            r.challenge.exists &&
            !r.challenge.settled &&
            Date.now() / 1000 < parseInt(r.challenge.endTime);
          const canEnd =
            r.challenge.exists &&
            !r.challenge.settled &&
            Date.now() / 1000 >= parseInt(r.challenge.endTime);

          return (
            <ReviewCard
              key={i}
              review={r}
              index={i}
              onHelpful={() => handleHelpful(i)}
              onChallenge={() => handleChallenge(i)}
              onVote={(agree) => handleVote(i, agree)}
              onEnd={() => handleEnd(i)}
              canVote={canVote}
              canEnd={canEnd}
            />
          );
        })}
      </div>
    </div>
  );
}
