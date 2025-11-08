Blockchain-Based Online Review System (Minimal Demo)

This minimal end-to-end app uses Solidity (Truffle + Ganache) and a React frontend (ethers). It demonstrates:
- Product listing by seller
- Purchase (ETH payment)
- Buyer-only reviews with stake
- Helpful scoring
- Challenge + community voting with stake

Prerequisites
- Node.js LTS
- Ganache (GUI or CLI)
- Truffle (npm i -g truffle)

Setup
1) Start Ganache on 127.0.0.1:7545
2) Deploy contracts
```
cd scratchproj
truffle compile
truffle migrate --reset --network development
```
3) Start frontend (direct-to-chain, no backend needed)
```
cd ../frontend
npm install
npm start
```
Open http://localhost:5173. In `frontend/src/config.js`, set `CONTRACT_ADDRESS` to the deployed address from `truffle migrate`.

Smart Contract (contracts/ReviewSystem.sol)
- listProduct(name, priceWei)
- purchaseProduct(productId) payable
- postReview(productId, rating, comment) payable
- giveHelpfulScore(productId, reviewId)
- challengeReview(productId, reviewId) payable
- voteOnChallenge(productId, reviewId, supports) payable
- finalizeChallenge(productId, reviewId)
- withdraw()

Tests
```
truffle test
```
Includes flow: list, purchase, review, challenge, vote, finalize.

Notes
- Review stake: 0.001 ETH; Challenge window: 3 minutes (demo).
- Distribution simplified for demo purposes.

