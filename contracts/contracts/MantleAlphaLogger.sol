// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MantleAlphaLogger {
    address public owner;
    uint256 public signalCount;

    struct Signal {
        uint256 id;
        uint256 timestamp;
        string signalType;     // "whale_alert" | "defi_anomaly" | "alpha_signal" | "macro_event"
        string asset;          // "MNT" | "WETH" | "USDT" | "mETH"
        string direction;      // "bullish" | "bearish" | "neutral"
        uint8  confidence;     // 1-10
        string committeeGrade; // "A" | "B" | "C" | "D" | "F"
        string goNoGo;         // "go" | "caution" | "no-go"
        string ipfsHash;       // IPFS hash of full analysis JSON (optional)
        string summary;        // Short on-chain summary (max 280 chars)
    }

    mapping(uint256 => Signal) public signals;

    event SignalLogged(
        uint256 indexed id,
        uint256 timestamp,
        string signalType,
        string asset,
        string direction,
        uint8  confidence,
        string committeeGrade,
        string goNoGo,
        string summary
    );

    event AgentRegistered(address indexed agent, string name, uint256 timestamp);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        emit AgentRegistered(msg.sender, "HamaFX-Alpha-Agent", block.timestamp);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner cannot be zero address");
        owner = newOwner;
        emit AgentRegistered(newOwner, "HamaFX-Alpha-Agent (Rotated)", block.timestamp);
    }

    struct LogSignalParams {
        string signalType;
        string asset;
        string direction;
        uint8 confidence;
        string committeeGrade;
        string goNoGo;
        string ipfsHash;
        string summary;
    }

    function logSignal(LogSignalParams calldata params) external onlyOwner returns (uint256) {
        signalCount++;
        signals[signalCount] = Signal({
            id: signalCount,
            timestamp: block.timestamp,
            signalType: params.signalType,
            asset: params.asset,
            direction: params.direction,
            confidence: params.confidence,
            committeeGrade: params.committeeGrade,
            goNoGo: params.goNoGo,
            ipfsHash: params.ipfsHash,
            summary: params.summary
        });

        emit SignalLogged(
            signalCount,
            block.timestamp,
            params.signalType,
            params.asset,
            params.direction,
            params.confidence,
            params.committeeGrade,
            params.goNoGo,
            params.summary
        );

        return signalCount;
    }

    function getSignal(uint256 id) external view returns (Signal memory) {
        require(id > 0 && id <= signalCount, "Invalid signal ID");
        return signals[id];
    }

    function getLatestSignals(uint256 count) external view returns (Signal[] memory) {
        uint256 resultCount = count > signalCount ? signalCount : count;
        Signal[] memory result = new Signal[](resultCount);
        for (uint256 i = 0; i < resultCount; i++) {
            result[i] = signals[signalCount - i];
        }
        return result;
    }
}
