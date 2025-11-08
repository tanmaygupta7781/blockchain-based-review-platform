// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/// @title Minimal blockchain review system with roles, verified purchase, helpful votes, and challenge voting
/// @notice Includes single-vote-per-user and clear settlement with reward distribution
contract ReviewSystem {
    // ---------- Roles ----------
    enum Role { Customer, Seller }
    mapping(address => Role) public roles;

    // ---------- Products ----------
    struct Product {
        uint256 id;
        string name;
        uint256 price; // in wei
        address payable seller;
        bool exists;
    }
    uint256 public productCount;
    mapping(uint256 => Product) public products;
    // productId => buyer => purchased?
    mapping(uint256 => mapping(address => bool)) public hasPurchased;

    // ---------- Reviews ----------
    struct Review {
        uint256 id;
        uint256 productId;
        address reviewer;
        string content;
        uint256 stake;       // reviewer stake (held until challenge ends or can be withdrawn if no challenge)
        uint256 helpfuls;    // count of helpful votes (off-chain analytics may also use events)
        bool challenged;     // true once a challenge is opened
        bool removed;        // set true if challenge-agree side wins (review deemed undesirable)
    }
    // productId => list of reviews
    mapping(uint256 => Review[]) public productReviews;

    // prevent multiple helpful scores from same user per review
    // key = keccak256(productId, reviewIndex) => voter => given?
    mapping(bytes32 => mapping(address => bool)) public helpfulGiven;

    // ---------- Challenges & Voting ----------
    struct Challenge {
        bool exists;
        uint256 productId;
        uint256 reviewIndex;       // index in productReviews[productId]
        address payable challenger;
        uint256 challengerStake;

        uint256 endTime;           // unix time, after which settlement is allowed

        uint256 agreeStake;        // stake for "agree" (review is undesirable)
        uint256 disagreeStake;     // stake for "disagree" (review stays)

        // voting control
        mapping(address => bool) hasVoted;   // one vote per user
        mapping(address => bool) votedAgree; // side chosen
        mapping(address => uint256) stakeByVoter;

        address[] agreeVoters;
        address[] disagreeVoters;

        bool settled;
    }
    // key per challenge: keccak256(productId, reviewIndex)
    mapping(bytes32 => Challenge) private challenges;

    // ---------- Events ----------
    event ProductListed(uint256 indexed id, string name, uint256 price, address indexed seller);
    event ProductPurchased(uint256 indexed id, address indexed buyer);
    event ReviewPosted(uint256 indexed id, uint256 indexed productId, address indexed reviewer, uint256 stake);
    event HelpfulScore(uint256 indexed productId, uint256 indexed reviewIndex, address indexed voter);
    event ReviewChallenged(uint256 indexed productId, uint256 indexed reviewIndex, address indexed challenger, uint256 stake, uint256 endTime);
    event ReviewVoted(uint256 indexed productId, uint256 indexed reviewIndex, address indexed voter, bool agree, uint256 stake);
    event ChallengeSettled(uint256 indexed productId, uint256 indexed reviewIndex, bool agreeWon, uint256 totalPayout);

    // ---------- Modifiers ----------
    modifier productExists(uint256 _pid) {
        require(products[_pid].exists, "Product does not exist");
        _;
    }

    // ---------- Role Logic ----------
    function _ensureSeller(address user) internal {
        if (roles[user] != Role.Seller) {
            roles[user] = Role.Seller;
        }
    }

    // ---------- Product ----------
    function listProduct(string memory _name, uint256 _price) external {
        require(bytes(_name).length > 0, "Name required");
        require(_price > 0, "Price must be > 0");
        productCount += 1;
        products[productCount] = Product({
            id: productCount,
            name: _name,
            price: _price,
            seller: payable(msg.sender),
            exists: true
        });
        _ensureSeller(msg.sender);
        emit ProductListed(productCount, _name, _price, msg.sender);
    }

    function purchaseProduct(uint256 _id) external payable productExists(_id) {
        Product storage p = products[_id];
        require(msg.value == p.price, "Incorrect price");
        hasPurchased[_id][msg.sender] = true;
        // effects before interaction
        address payable seller = p.seller;
        uint256 amount = msg.value;
        // interaction
        (bool ok, ) = seller.call{value: amount}("");
        require(ok, "Payment failed");
        emit ProductPurchased(_id, msg.sender);
    }

    // ---------- Reviews ----------
    function postReview(uint256 _productId, string memory _content) external payable productExists(_productId) {
        require(roles[msg.sender] != Role.Seller, "Sellers cannot review");
        require(hasPurchased[_productId][msg.sender], "Only verified buyers can review");
        require(msg.value > 0, "Stake required");
        require(bytes(_content).length > 0, "Content required");

        Review[] storage list = productReviews[_productId];
        uint256 newId = list.length + 1;
        list.push(Review({
            id: newId,
            productId: _productId,
            reviewer: msg.sender,
            content: _content,
            stake: msg.value,
            helpfuls: 0,
            challenged: false,
            removed: false
        }));
        emit ReviewPosted(newId, _productId, msg.sender, msg.value);
    }

    function giveHelpfulScore(uint256 _productId, uint256 _reviewIndex) external productExists(_productId) {
        Review storage r = productReviews[_productId][_reviewIndex];
        bytes32 key = keccak256(abi.encodePacked(_productId, _reviewIndex));
        require(!helpfulGiven[key][msg.sender], "Already marked helpful");
        helpfulGiven[key][msg.sender] = true;
        r.helpfuls += 1;
        emit HelpfulScore(_productId, _reviewIndex, msg.sender);
    }

    // ---------- Challenge + Voting ----------
    function challengeReview(uint256 _productId, uint256 _reviewIndex) external payable productExists(_productId) {
        Review storage r = productReviews[_productId][_reviewIndex];
        require(!r.removed, "Review already removed");
        require(!r.challenged, "Already challenged");
        require(msg.value > r.stake, "Stake must exceed review stake");

        bytes32 key = keccak256(abi.encodePacked(_productId, _reviewIndex));
        Challenge storage c = challenges[key];
        require(!c.exists, "Challenge exists");

        c.exists = true;
        c.productId = _productId;
        c.reviewIndex = _reviewIndex;
        c.challenger = payable(msg.sender);
        c.challengerStake = msg.value;
        c.endTime = block.timestamp + 2 minutes;
        c.agreeStake = 0;
        c.disagreeStake = 0;
        c.settled = false;

        r.challenged = true;

        emit ReviewChallenged(_productId, _reviewIndex, msg.sender, msg.value, c.endTime);
    }

    function voteOnChallenge(uint256 _productId, uint256 _reviewIndex, bool agree) external payable productExists(_productId) {
        require(msg.value > 0, "Stake required");
        bytes32 key = keccak256(abi.encodePacked(_productId, _reviewIndex));
        Challenge storage c = challenges[key];
        require(c.exists, "No challenge");
        require(block.timestamp < c.endTime, "Voting ended");
        require(!c.hasVoted[msg.sender], "Already voted");

        c.hasVoted[msg.sender] = true;
        c.votedAgree[msg.sender] = agree;
        c.stakeByVoter[msg.sender] = msg.value;

        if (agree) {
            c.agreeStake += msg.value;
            c.agreeVoters.push(msg.sender);
        } else {
            c.disagreeStake += msg.value;
            c.disagreeVoters.push(msg.sender);
        }

        emit ReviewVoted(_productId, _reviewIndex, msg.sender, agree, msg.value);
    }

    /// @notice Ends a challenge, decides winner, distributes stakes
    /// agree side wins  => review.removed = true, winners: challenger + agree voters share (review stake + disagree stake)
    /// disagree side wins => review kept, winners: reviewer + disagree voters share (challenger stake + agree stake)
    function finalizeChallenge(uint256 _productId, uint256 _reviewIndex) external productExists(_productId) {
        bytes32 key = keccak256(abi.encodePacked(_productId, _reviewIndex));
        Challenge storage c = challenges[key];
        require(c.exists, "No challenge");
        require(!c.settled, "Already settled");
        require(block.timestamp >= c.endTime, "Too early");

        Review storage r = productReviews[_productId][_reviewIndex];

        // Determine winner
        bool agreeWon = (c.agreeStake >= c.disagreeStake);

        // Mark settled before transfers (checks-effects-interactions)
        c.settled = true;

        uint256 pool;
        if (agreeWon) {
            // agree winners: challenger + agree voters
            // losers: reviewer stake + disagree stake -> pool for winners
            pool = r.stake + c.disagreeStake;

            // pay back principal + proportional share to agree voters
            uint256 totalWinningStake = c.challengerStake + c.agreeStake;
            for (uint256 i = 0; i < c.agreeVoters.length; i++) {
                address payable v = payable(c.agreeVoters[i]);
                uint256 st = c.stakeByVoter[v];
                uint256 share = (totalWinningStake == 0) ? 0 : (pool * st) / totalWinningStake;
                (bool ok1, ) = v.call{value: st + share}("");
                require(ok1, "Agree voter payout failed");
            }
            // challenger gets back stake + proportional share
            uint256 chalShare = (totalWinningStake == 0) ? 0 : (pool * c.challengerStake) / totalWinningStake;
            (bool ok2, ) = c.challenger.call{value: c.challengerStake + chalShare}("");
            require(ok2, "Challenger payout failed");

            // reviewer loses stake, review removed
            r.removed = true;
        } else {
            // disagree winners: reviewer + disagree voters
            // losers: challenger stake + agree stake -> pool for winners
            pool = c.challengerStake + c.agreeStake;

            // pay back principal + proportional share to disagree voters
            uint256 totalWinningStake = r.stake + c.disagreeStake;
            for (uint256 j = 0; j < c.disagreeVoters.length; j++) {
                address payable v2 = payable(c.disagreeVoters[j]);
                uint256 st2 = c.stakeByVoter[v2];
                uint256 share2 = (totalWinningStake == 0) ? 0 : (pool * st2) / totalWinningStake;
                (bool ok3, ) = v2.call{value: st2 + share2}("");
                require(ok3, "Disagree voter payout failed");
            }

            // reviewer gets back stake + proportional share
            uint256 reviewerShare = (totalWinningStake == 0) ? 0 : (pool * r.stake) / totalWinningStake;
            (bool ok4, ) = payable(r.reviewer).call{value: r.stake + reviewerShare}("");
            require(ok4, "Reviewer payout failed");

            // review stays
            r.removed = false;
        }

        emit ChallengeSettled(_productId, _reviewIndex, agreeWon, pool);
    }

    // ---------- Read helpers for UI ----------
    function getReviews(uint256 _productId) external view returns (Review[] memory) {
        return productReviews[_productId];
    }

    function getChallenge(uint256 _productId, uint256 _reviewIndex)
        external
        view
        returns (bool exists, uint256 endTime, uint256 agreeStake, uint256 disagreeStake, bool settled)
    {
        bytes32 key = keccak256(abi.encodePacked(_productId, _reviewIndex));
        Challenge storage c = challenges[key];
        return (c.exists, c.endTime, c.agreeStake, c.disagreeStake, c.settled);
    }
}
