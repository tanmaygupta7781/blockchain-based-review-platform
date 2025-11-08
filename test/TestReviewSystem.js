const ReviewSystem = artifacts.require("ReviewSystem");

contract("ReviewSystem", (accounts) => {
  const [seller, buyer, challenger, voterA, voterB] = accounts;
  const productId = 1;
  const reviewIndex = 0; // The first review for a product will have index 0

  // Helper function to advance time in Ganache
  const advanceTime = async (time) => {
    await new Promise((resolve, reject) => {
      web3.currentProvider.send({
        jsonrpc: '2.0',
        method: 'evm_increaseTime',
        params: [time],
        id: new Date().getTime()
      }, (err, result) => {
        if (err) { return reject(err); }
        return resolve(result);
      });
    });

    await new Promise((resolve, reject) => {
      web3.currentProvider.send({
        jsonrpc: '2.0',
        method: 'evm_mine',
        params: [],
        id: new Date().getTime()
      }, (err, result) => {
        if (err) { return reject(err); }
        return resolve(result);
      });
    });
  };

  it("should allow a user to purchase a product and the seller to receive the funds", async () => {
    const instance = await ReviewSystem.new();
    const productPrice = web3.utils.toWei("1", "ether");

    const sellerBalanceBefore = await web3.eth.getBalance(seller);
    console.log("Seller balance before purchase:", web3.utils.fromWei(sellerBalanceBefore, "ether"));

    await instance.listProduct("Test Product", productPrice, { from: seller });
    await instance.purchaseProduct(productId, { from: buyer, value: productPrice });

    const sellerBalanceAfter = await web3.eth.getBalance(seller);
    console.log("Seller balance after purchase:", web3.utils.fromWei(sellerBalanceAfter, "ether"));

    const product = await instance.products(productId);
    assert.equal(product.seller, seller, "The seller should be the one who listed the product.");

    const hasPurchased = await instance.hasPurchased(productId, buyer);
    assert.isTrue(hasPurchased, "The buyer should be marked as having purchased the product.");
    
    const expectedBalance = BigInt(sellerBalanceBefore) + BigInt(productPrice);
    assert.equal(sellerBalanceAfter.toString(), expectedBalance.toString(), "The seller's balance should be increased by the product price.");
  });

  it("should handle the full challenge process with the 'agree' side winning", async () => {
    const instance = await ReviewSystem.new();
    const productPrice = web3.utils.toWei("1", "ether");
    const reviewStake = web3.utils.toWei("0.1", "ether");
    const challengerStake = web3.utils.toWei("0.2", "ether");
    const voterAStake = web3.utils.toWei("0.1", "ether");

    // List and purchase product
    await instance.listProduct("Test Product", productPrice, { from: seller });
    await instance.purchaseProduct(productId, { from: buyer, value: productPrice });

    // Post a review
    await instance.postReview(productId, "This is a test review", { from: buyer, value: reviewStake });

    // Challenge the review
    await instance.challengeReview(productId, reviewIndex, { from: challenger, value: challengerStake });

    // Vote on the challenge
    await instance.voteOnChallenge(productId, reviewIndex, true, { from: voterA, value: voterAStake }); // Agree vote

    // Check balances before finalizing
    const challengerBalanceBefore = await web3.eth.getBalance(challenger);
    const voterABalanceBefore = await web3.eth.getBalance(voterA);
    const buyerBalanceBefore = await web3.eth.getBalance(buyer); // Reviewer

    console.log("\n--- AGREE WINS ---");
    console.log("Challenger balance before finalize:", web3.utils.fromWei(challengerBalanceBefore, "ether"));
    console.log("Voter A balance before finalize:", web3.utils.fromWei(voterABalanceBefore, "ether"));
    console.log("Reviewer (Buyer) balance before finalize:", web3.utils.fromWei(buyerBalanceBefore, "ether"));

    // Advance time past the challenge end time (30 seconds)
    await advanceTime(31);

    // Finalize the challenge
    await instance.finalizeChallenge(productId, reviewIndex, { from: seller });

    // Check balances after finalizing
    const challengerBalanceAfter = await web3.eth.getBalance(challenger);
    const voterABalanceAfter = await web3.eth.getBalance(voterA);
    const buyerBalanceAfter = await web3.eth.getBalance(buyer); // Reviewer

    console.log("Challenger balance after finalize:", web3.utils.fromWei(challengerBalanceAfter, "ether"));
    console.log("Voter A balance after finalize:", web3.utils.fromWei(voterABalanceAfter, "ether"));
    console.log("Reviewer (Buyer) balance after finalize:", web3.utils.fromWei(buyerBalanceAfter, "ether"));

    // Assertions
    const review = (await instance.getReviews(productId))[reviewIndex];
    assert.isTrue(review.removed, "The review should be removed.");
    assert.isTrue(new web3.utils.BN(challengerBalanceAfter).gt(new web3.utils.BN(challengerBalanceBefore)), "Challenger should have a higher balance.");
    assert.isTrue(new web3.utils.BN(voterABalanceAfter).gt(new web3.utils.BN(voterABalanceBefore)), "Voter A should have a higher balance.");
    // Buyer's balance should be lower because they lost their stake and paid for gas
    assert.isTrue(new web3.utils.BN(buyerBalanceAfter).lt(new web3.utils.BN(buyerBalanceBefore)), "Reviewer should have a lower balance.");
  });

  it("should handle the full challenge process with the 'disagree' side winning", async () => {
    const instance = await ReviewSystem.new();
    const productPrice = web3.utils.toWei("1", "ether");
    const reviewStake = web3.utils.toWei("0.2", "ether"); // Higher stake for reviewer
    const challengerStake = web3.utils.toWei("0.1", "ether");
    const voterBStake = web3.utils.toWei("0.1", "ether");

    // List and purchase product
    await instance.listProduct("Test Product", productPrice, { from: seller });
    await instance.purchaseProduct(productId, { from: buyer, value: productPrice });

    // Post a review
    await instance.postReview(productId, "This is a test review", { from: buyer, value: reviewStake });

    // Challenge the review
    await instance.challengeReview(productId, reviewIndex, { from: challenger, value: challengerStake });

    // Vote on the challenge
    await instance.voteOnChallenge(productId, reviewIndex, false, { from: voterB, value: voterBStake }); // Disagree vote

    // Check balances before finalizing
    const challengerBalanceBefore = await web3.eth.getBalance(challenger);
    const voterBBalanceBefore = await web3.eth.getBalance(voterB);
    const buyerBalanceBefore = await web3.eth.getBalance(buyer); // Reviewer

    console.log("\n--- DISAGREE WINS ---");
    console.log("Challenger balance before finalize:", web3.utils.fromWei(challengerBalanceBefore, "ether"));
    console.log("Voter B balance before finalize:", web3.utils.fromWei(voterBBalanceBefore, "ether"));
    console.log("Reviewer (Buyer) balance before finalize:", web3.utils.fromWei(buyerBalanceBefore, "ether"));

    // Advance time past the challenge end time (30 seconds)
    await advanceTime(31);

    // Finalize the challenge
    await instance.finalizeChallenge(productId, reviewIndex, { from: seller });

    // Check balances after finalizing
    const challengerBalanceAfter = await web3.eth.getBalance(challenger);
    const voterBBalanceAfter = await web3.eth.getBalance(voterB);
    const buyerBalanceAfter = await web3.eth.getBalance(buyer); // Reviewer

    console.log("Challenger balance after finalize:", web3.utils.fromWei(challengerBalanceAfter, "ether"));
    console.log("Voter B balance after finalize:", web3.utils.fromWei(voterBBalanceAfter, "ether"));
    console.log("Reviewer (Buyer) balance after finalize:", web3.utils.fromWei(buyerBalanceAfter, "ether"));

    // Assertions
    const review = (await instance.getReviews(productId))[reviewIndex];
    assert.isFalse(review.removed, "The review should not be removed.");
    assert.isTrue(new web3.utils.BN(buyerBalanceAfter).gt(new web3.utils.BN(buyerBalanceBefore)), "Reviewer should have a higher balance.");
    assert.isTrue(new web3.utils.BN(voterBBalanceAfter).gt(new web3.utils.BN(voterBBalanceBefore)), "Voter B should have a higher balance.");
    // Challenger's balance should be lower because they lost their stake and paid for gas
    assert.isTrue(new web3.utils.BN(challengerBalanceAfter).lt(new web3.utils.BN(challengerBalanceBefore)), "Challenger should have a lower balance.");
  });
});
