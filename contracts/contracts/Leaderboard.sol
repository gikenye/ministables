// SPDX-License-Identifier: MIT
// author: hagiasofia
pragma solidity ^0.8.24;


import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract Leaderboard is Initializable, AccessControlUpgradeable, UUPSUpgradeable {
    bytes32 public constant ADMIN_ROLE = DEFAULT_ADMIN_ROLE;
    bytes32 public constant BACKEND_ROLE = keccak256("BACKEND_ROLE");

    address public goalManager;
    mapping(address => uint256) public scores;
    address[] public topList;
    uint256 public topN;

    event GoalManagerSet(address indexed manager);
    event DepositRecorded(address indexed user, uint256 amount, uint256 newScore);
    event GoalCompletedRecorded(address indexed user, uint256 goalId, uint256 totalValue, uint256 bonus, uint256 newScore);
    event TopListUpdated(address[] newTopList);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin, uint256 _topN) external initializer {
        require(admin != address(0), "Invalid admin");
        require(_topN > 0 && _topN <= 500, "Invalid topN");
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(ADMIN_ROLE, admin);
        topN = _topN;
    }

    function _authorizeUpgrade(address) internal override onlyRole(ADMIN_ROLE) {}

    function setGoalManager(address mgr) external onlyRole(ADMIN_ROLE) {
        require(mgr != address(0), "Invalid manager");
        goalManager = mgr;
        emit GoalManagerSet(mgr);
    }

    modifier onlyGoalManager() {
        require(msg.sender == goalManager, "Only GoalManager");
        _;
    }

    function recordDeposit(address user, uint256 amount) external onlyGoalManager {
        if (user == address(0) || amount == 0) return;
        scores[user] += amount;
        _maybeUpdateTop(user);
        emit DepositRecorded(user, amount, scores[user]);
    }

    function recordDepositOnBehalf(address user, uint256 amount) external onlyRole(BACKEND_ROLE) {
        if (user == address(0) || amount == 0) return;
        scores[user] += amount;
        _maybeUpdateTop(user);
        emit DepositRecorded(user, amount, scores[user]);
    }

    function recordGoalCompletion(address user, uint256 goalId, uint256 totalValue) external onlyGoalManager {
        if (user == address(0) || totalValue == 0) return;
        uint256 bonus = totalValue / 10;
        scores[user] += bonus;
        _maybeUpdateTop(user);
        emit GoalCompletedRecorded(user, goalId, totalValue, bonus, scores[user]);
    }

    function getUserScore(address user) external view returns (uint256) {
        return scores[user];
    }

    function getTopListLength() external view returns (uint256) {
        return topList.length;
    }

    function getTopRange(uint256 start, uint256 end) external view returns (address[] memory users, uint256[] memory userScores) {
        uint256 len = topList.length;
        if (start >= len) return (new address[](0), new uint256[](0));
        if (end > len) end = len;
        uint256 outLen = end - start;
        users = new address[](outLen);
        userScores = new uint256[](outLen);
        for (uint256 i = 0; i < outLen; i++) {
            address u = topList[start + i];
            users[i] = u;
            userScores[i] = scores[u];
        }
    }

    function _maybeUpdateTop(address user) internal {
        uint256 userScore = scores[user];
        int256 idx = _indexOf(user);
        if (idx >= 0) {
            uint256 i = uint256(uint256(int256(idx)));
            while (i > 0 && scores[topList[i]] > scores[topList[i - 1]]) {
                address tmp = topList[i - 1];
                topList[i - 1] = topList[i];
                topList[i] = tmp;
                i--;
            }
            emit TopListUpdated(topList);
            return;
        }

        if (topList.length < topN) {
            topList.push(user);
            uint256 pos = topList.length - 1;
            while (pos > 0 && scores[topList[pos]] > scores[topList[pos - 1]]) {
                address tmp = topList[pos - 1];
                topList[pos - 1] = topList[pos];
                topList[pos] = tmp;
                pos--;
            }
            emit TopListUpdated(topList);
            return;
        }

        uint256 lastIndex = topList.length - 1;
        address lastUser = topList[lastIndex];
        if (userScore <= scores[lastUser]) return;
        topList[lastIndex] = user;
        uint256 pos2 = lastIndex;
        while (pos2 > 0 && scores[topList[pos2]] > scores[topList[pos2 - 1]]) {
            address tmp2 = topList[pos2 - 1];
            topList[pos2 - 1] = topList[pos2];
            topList[pos2] = tmp2;
            pos2--;
        }
        emit TopListUpdated(topList);
    }

    function _indexOf(address user) internal view returns (int256) {
        for (uint256 i = 0; i < topList.length; i++) {
            if (topList[i] == user) return int256(int256(i));
        }
        return -1;
    }
}