// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title CarbonCreditRegistry
/// @notice On-chain registry for verified carbon credits.
/// Each credit is a unique, non-divisible issuance record. A credit has exactly
/// one owner at a time, and once it is RETIRED it can never be transferred or
/// retired again - this is what prevents double counting / double selling of
/// the same tonne of CO2e, the core trust problem in voluntary carbon markets.
/// Project metadata lives off-chain; its SHA-256 hash is anchored here at
/// issuance so any later tampering with the metadata is detectable by anyone.
contract CarbonCreditRegistry {
    struct Credit {
        uint256 id;
        address issuer;      // verifier/registry account that issued the credit
        address owner;       // current owner (project developer, broker or buyer)
        uint256 amountTonnes; // tonnes of CO2e this credit represents
        bytes32 metadataHash; // SHA-256 of the canonical project metadata JSON
        bool retired;
        uint256 issuedAt;
        uint256 retiredAt;
        string retireReason; // e.g. "Offsetting 2025 operations footprint"
    }

    address public admin;
    uint256 public nextId = 1;
    uint256 public totalIssuedTonnes;
    uint256 public totalRetiredTonnes;

    mapping(uint256 => Credit) private _credits;
    mapping(address => bool) public isVerifier;

    event VerifierAdded(address indexed verifier);
    event CreditIssued(uint256 indexed id, address indexed issuer, address indexed owner, uint256 amountTonnes, bytes32 metadataHash);
    event CreditTransferred(uint256 indexed id, address indexed from, address indexed to);
    event CreditRetired(uint256 indexed id, address indexed owner, string reason);

    modifier onlyAdmin() {
        require(msg.sender == admin, "only admin");
        _;
    }

    modifier onlyVerifier() {
        require(isVerifier[msg.sender], "only verifier");
        _;
    }

    constructor() {
        admin = msg.sender;
        isVerifier[msg.sender] = true;
        emit VerifierAdded(msg.sender);
    }

    function addVerifier(address verifier) external onlyAdmin {
        isVerifier[verifier] = true;
        emit VerifierAdded(verifier);
    }

    /// @notice Issue a new carbon credit to an initial owner.
    /// @param to initial owner of the credit
    /// @param amountTonnes tonnes of CO2e represented
    /// @param metadataHash SHA-256 hash of the off-chain project metadata
    function issue(address to, uint256 amountTonnes, bytes32 metadataHash)
        external
        onlyVerifier
        returns (uint256 id)
    {
        require(to != address(0), "invalid owner");
        require(amountTonnes > 0, "amount must be > 0");
        require(metadataHash != bytes32(0), "metadata hash required");

        id = nextId++;
        _credits[id] = Credit({
            id: id,
            issuer: msg.sender,
            owner: to,
            amountTonnes: amountTonnes,
            metadataHash: metadataHash,
            retired: false,
            issuedAt: block.timestamp,
            retiredAt: 0,
            retireReason: ""
        });
        totalIssuedTonnes += amountTonnes;
        emit CreditIssued(id, msg.sender, to, amountTonnes, metadataHash);
    }

    /// @notice Transfer ownership of an active credit. The server signs this
    /// with the current owner's key in the demo; in production each owner
    /// would sign with their own wallet.
    function transfer(address to, uint256 id) external {
        Credit storage c = _credits[id];
        require(c.id != 0, "credit does not exist");
        require(!c.retired, "retired credits cannot be transferred");
        require(msg.sender == c.owner, "only the owner can transfer");
        require(to != address(0) && to != c.owner, "invalid recipient");
        address from = c.owner;
        c.owner = to;
        emit CreditTransferred(id, from, to);
    }

    /// @notice Permanently retire a credit so its tonnes can be claimed as an
    /// offset exactly once. Retirement is irreversible by design.
    function retire(uint256 id, string calldata reason) external {
        Credit storage c = _credits[id];
        require(c.id != 0, "credit does not exist");
        require(!c.retired, "credit already retired");
        require(msg.sender == c.owner, "only the owner can retire");
        c.retired = true;
        c.retiredAt = block.timestamp;
        c.retireReason = reason;
        totalRetiredTonnes += c.amountTonnes;
        emit CreditRetired(id, msg.sender, reason);
    }

    function getCredit(uint256 id) external view returns (Credit memory) {
        require(_credits[id].id != 0, "credit does not exist");
        return _credits[id];
    }

    function creditCount() external view returns (uint256) {
        return nextId - 1;
    }
}
