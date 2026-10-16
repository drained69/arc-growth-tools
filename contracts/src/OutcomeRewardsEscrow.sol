// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.30;

interface IRewardToken {
    function balanceOf(address account) external view returns (uint256);
}

/// @notice Prefunded, bounded creator rewards. Outcome truth and quality remain business attestations.
/// @dev Prototype for testnet evaluation. Terms are immutable; payment recipients cannot be edited.
contract OutcomeRewardsEscrow {
    address public immutable token;
    uint256 public immutable refundHold;
    uint256 public constant REVIEW_WINDOW = 7 days;
    bool private entered;

    struct Campaign {
        address owner;
        address arbiter;
        uint256 deadline;
        uint256 available;
        uint256 reserved;
        uint256 base;
        uint256 qualityBonus;
        uint256 outcomeBonus;
        uint256 outcomeCap;
        uint256 slots;
        uint256 queued;
        bytes32 termsHash;
    }
    struct Reward {
        address recipient;
        uint256 amount;
        uint256 quality;
        uint256 outcomes;
        uint256 claimableAt;
        bytes32 evidenceHash;
        bool disputed;
        bool closed;
    }
    mapping(bytes32 => Campaign) public campaigns;
    mapping(bytes32 => mapping(bytes32 => Reward)) public rewards;
    mapping(bytes32 => mapping(address => bool)) public hasReward;

    event CampaignFunded(bytes32 indexed campaignId, address indexed owner, uint256 amount, bytes32 termsHash);
    event RewardQueued(bytes32 indexed campaignId, bytes32 indexed rewardId, address recipient, uint256 amount, bytes32 evidenceHash);
    event OutcomesReduced(bytes32 indexed campaignId, bytes32 indexed rewardId, uint256 outcomes, uint256 amount, bytes32 evidenceHash);
    event RewardDisputed(bytes32 indexed campaignId, bytes32 indexed rewardId);
    event DisputeResolved(bytes32 indexed campaignId, bytes32 indexed rewardId, bool release);
    event RewardPaid(bytes32 indexed campaignId, bytes32 indexed rewardId, address recipient, uint256 amount);
    event UnusedRefunded(bytes32 indexed campaignId, uint256 amount);

    modifier nonReentrant() { require(!entered, "reentrant"); entered = true; _; entered = false; }
    constructor(address usdc, uint256 hold) {
        require(usdc != address(0) && hold >= 1 days, "invalid configuration");
        IRewardToken(usdc).balanceOf(address(this)); // Reject a non-token address, including empty-code EOAs.
        token = usdc; refundHold = hold;
    }
    function amountFor(Campaign storage c, uint256 quality, uint256 outcomes) private view returns (uint256) {
        require(quality <= 100 && outcomes <= c.outcomeCap, "reward exceeds terms");
        return c.base + c.qualityBonus * quality / 100 + c.outcomeBonus * outcomes;
    }
    function transferToken(address to, uint256 amount) private {
        (bool ok, bytes memory result) = token.call(abi.encodeWithSignature("transfer(address,uint256)", to, amount));
        require(ok && (result.length == 0 || abi.decode(result,(bool))), "token transfer failed");
    }
    function createCampaign(bytes32 campaignId, address arbiter, uint256 deadline, uint256 budget, uint256 base, uint256 qualityBonus, uint256 outcomeBonus, uint256 outcomeCap, uint256 slots, bytes32 termsHash) external nonReentrant {
        require(campaignId != bytes32(0) && campaigns[campaignId].owner == address(0), "campaign exists");
        require(arbiter != address(0) && arbiter != msg.sender && deadline > block.timestamp && slots > 0 && slots <= 1000 && base > 0 && termsHash != bytes32(0), "invalid terms");
        require(outcomeCap <= 100 && budget >= (base + qualityBonus + outcomeBonus * outcomeCap) * slots, "insufficient reward pool");
        campaigns[campaignId] = Campaign(msg.sender,arbiter,deadline,budget,0,base,qualityBonus,outcomeBonus,outcomeCap,slots,0,termsHash);
        uint256 beforeBalance = IRewardToken(token).balanceOf(address(this));
        (bool ok, bytes memory result) = token.call(abi.encodeWithSignature("transferFrom(address,address,uint256)",msg.sender,address(this),budget));
        require(ok && (result.length == 0 || abi.decode(result,(bool))) && IRewardToken(token).balanceOf(address(this)) == beforeBalance + budget, "funding failed");
        emit CampaignFunded(campaignId,msg.sender,budget,termsHash);
    }
    function queueReward(bytes32 campaignId, bytes32 rewardId, address recipient, uint256 quality, uint256 outcomes, bytes32 evidenceHash) external nonReentrant {
        Campaign storage c = campaigns[campaignId];
        require(msg.sender == c.owner, "owner only");
        require(block.timestamp >= c.deadline && block.timestamp <= c.deadline + REVIEW_WINDOW, "outside review window");
        require(rewardId != bytes32(0) && rewards[campaignId][rewardId].recipient == address(0) && recipient != address(0) && !hasReward[campaignId][recipient], "duplicate or invalid recipient");
        require(c.queued < c.slots && evidenceHash != bytes32(0), "slots or evidence");
        uint256 amount = amountFor(c,quality,outcomes);
        require(amount <= c.available, "pool exhausted");
        c.available -= amount; c.reserved += amount; c.queued++;
        hasReward[campaignId][recipient] = true;
        rewards[campaignId][rewardId] = Reward(recipient,amount,quality,outcomes,block.timestamp + refundHold,evidenceHash,false,false);
        emit RewardQueued(campaignId,rewardId,recipient,amount,evidenceHash);
    }
    /// @notice Merchant refunds can reduce pending outcome bonuses; accepted base/quality remain protected.
    function reduceOutcomes(bytes32 campaignId, bytes32 rewardId, uint256 outcomes, bytes32 evidenceHash) external nonReentrant {
        Campaign storage c = campaigns[campaignId]; Reward storage r = rewards[campaignId][rewardId];
        require(msg.sender == c.owner && r.recipient != address(0) && !r.closed && !r.disputed && block.timestamp < r.claimableAt, "cannot adjust");
        require(outcomes <= r.outcomes && evidenceHash != bytes32(0), "only decrease outcomes");
        uint256 amount = amountFor(c,r.quality,outcomes);
        c.reserved -= r.amount - amount; c.available += r.amount - amount;
        r.amount = amount; r.outcomes = outcomes; r.evidenceHash = evidenceHash;
        emit OutcomesReduced(campaignId,rewardId,outcomes,amount,evidenceHash);
    }
    function dispute(bytes32 campaignId, bytes32 rewardId) external nonReentrant {
        Campaign storage c = campaigns[campaignId]; Reward storage r = rewards[campaignId][rewardId];
        require((msg.sender == c.owner || msg.sender == r.recipient) && r.recipient != address(0) && !r.closed && block.timestamp < r.claimableAt, "cannot dispute");
        r.disputed = true; emit RewardDisputed(campaignId,rewardId);
    }
    function resolve(bytes32 campaignId, bytes32 rewardId, bool release) external nonReentrant {
        Campaign storage c = campaigns[campaignId]; Reward storage r = rewards[campaignId][rewardId];
        require(msg.sender == c.arbiter && r.disputed && !r.closed, "arbiter only");
        r.disputed = false;
        if (!release) { r.closed = true; c.reserved -= r.amount; c.available += r.amount; }
        emit DisputeResolved(campaignId,rewardId,release);
    }
    /// @notice Anyone may relay a claim; funds always reach the bound recipient.
    function claim(bytes32 campaignId, bytes32 rewardId) external nonReentrant {
        Campaign storage c = campaigns[campaignId]; Reward storage r = rewards[campaignId][rewardId];
        require(r.recipient != address(0) && !r.closed && !r.disputed && block.timestamp >= r.claimableAt, "not claimable");
        r.closed = true; c.reserved -= r.amount;
        transferToken(r.recipient,r.amount); emit RewardPaid(campaignId,rewardId,r.recipient,r.amount);
    }
    function refundUnused(bytes32 campaignId) external nonReentrant {
        Campaign storage c = campaigns[campaignId];
        require(msg.sender == c.owner && block.timestamp > c.deadline + REVIEW_WINDOW, "review still open");
        uint256 amount = c.available; require(amount > 0,"nothing unused"); c.available = 0;
        transferToken(c.owner,amount); emit UnusedRefunded(campaignId,amount);
    }
}
