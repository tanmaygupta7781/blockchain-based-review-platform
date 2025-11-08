import React from "react";

export default function ReviewCard({ review, index, onHelpful, onChallenge, onVote, onEnd }) {
  return (
    <div className="p-4 rounded-xl shadow bg-gray-50">
      <p className="font-medium">{review.content}</p>
      <p className="text-sm text-gray-500">
        Stake: {review.stake.toString()} wei | Helpful: {review.helpfuls.toString()}
      </p>
      {review.removed && <span className="text-red-600 text-xs">[Removed]</span>}
      {review.challenged && !review.removed && <span className="text-yellow-600 text-xs">[Challenged]</span>}

      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={onHelpful} className="px-3 py-1 bg-green-600 text-white rounded">
          Helpful
        </button>
        <button onClick={onChallenge} className="px-3 py-1 bg-red-600 text-white rounded">
          Challenge
        </button>
        <button onClick={() => onVote(true)} className="px-3 py-1 bg-blue-600 text-white rounded">
          Vote Agree
        </button>
        <button onClick={() => onVote(false)} className="px-3 py-1 bg-purple-600 text-white rounded">
          Vote Disagree
        </button>
        <button onClick={onEnd} className="px-3 py-1 bg-gray-800 text-white rounded">
          End Challenge
        </button>
      </div>
    </div>
  );
}
