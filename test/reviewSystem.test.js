const ReviewSystem = artifacts.require("ReviewSystem");

contract("ReviewSystem", (accounts) => {
  const [seller, buyer, challenger, voterA, voterB] = accounts;

  let instance;

  beforeEach(async () => {
    instance = await ReviewSystem.new();
  });

  it("lists a product and allows purchase, review, challenge, vote and finalize", async () => {
    // list product
    await instance.listProduct("Widget", web3.utils.toWei("0.01", "ether"), { from: seller });
    const product = await instance.getProduct(1);
    assert.equal(product.name, "Widget");

    // purchase
    await instance.purchaseProduct(1, { from: buyer, value: web3.utils.toWei("0.01", "ether") });

    // post review (stake 0.001 ETH)
    const stake = web3.utils.toWei("0.001", "ether");
    const tx = await instance.postReview(1, 5, "Great!", { from: buyer, value: stake });
    const reviewId = tx.logs.find(l => l.event === 'ReviewPosted').args.reviewId.toNumber();

    // helpful
    await instance.giveHelpfulScore(1, reviewId, { from: voterA });

    // challenge with higher stake
    await instance.challengeReview(1, reviewId, { from: challenger, value: web3.utils.toWei("0.002", "ether") });

    // votes
    await instance.voteOnChallenge(1, reviewId, true, { from: voterA, value: web3.utils.toWei("0.001", "ether") }); // supports removal
    await instance.voteOnChallenge(1, reviewId, false, { from: voterB, value: web3.utils.toWei("0.001", "ether") }); // opposes removal

    // fast forward time by mining after endTime is cumbersome in Truffle without helpers.
    // Instead, we simulate by directly calling finalize after adjusting block timestamp via evm_increaseTime.
    await advanceTime(200);
    await instance.finalizeChallenge(1, reviewId, { from: seller });

    // No assert on exact outcome due to proportional splitting; just ensure it finalized without revert
    // and that withdraw works if any balance present.
    const claimableChallenger = await instance.claimableWei(challenger);
    if (claimableChallenger.toString() !== '0') {
      await instance.withdraw({ from: challenger });
    }
  });
});

async function advanceTime(sec) {
  await new Promise((resolve, reject) => {
    web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_increaseTime',
      params: [sec],
      id: new Date().getTime()
    }, (err) => {
      if (err) return reject(err);
      web3.currentProvider.send({
        jsonrpc: '2.0',
        method: 'evm_mine',
        params: [],
        id: new Date().getTime()
      }, (err2) => {
        if (err2) return reject(err2);
        resolve();
      });
    });
  });
}


