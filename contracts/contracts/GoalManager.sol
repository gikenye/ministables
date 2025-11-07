// SPDX-License-Identifier: MIT
// author: hagiasofia
pragma solidity ^0.8.24;

/*
  GoalManager

  - Does NOT hold funds. All funds remain in SupplierVault(s).
  - Creates per-user quicksave goals (per vault) automatically when notified by trusted notifiers.
  - Users can create named goals, attach whole deposits (by depositId) from SupplierVaults, transfer deposits between their goals, detach when allowed.
  - Batched attach/detach and paged progress queries to keep gas bounded.
  - Keeper/admin finalization for completed goals (keeps onchain gas manageable).
*/

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

interface ISupplierVaultMinimal {
    function getUserDeposit(address user, uint256 depositId)
        external
        view
        returns (
            uint256 principal,
            uint256 currentValue,
            uint256 yieldEarned,
            uint256 lockEnd,
            bool canWithdraw
        );

    function isDepositPledged(address user, uint256 depositId) external view returns (bool);
}

interface ILeaderboard {
    function recordDeposit(address user, uint256 amount) external;
    function recordGoalCompletion(address user, uint256 goalId, uint256 totalValue) external;
}

contract GoalManager is Initializable, AccessControlUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable {
    bytes32 public constant ADMIN_ROLE = DEFAULT_ADMIN_ROLE;
    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");
    bytes32 public constant BACKEND_ROLE = keccak256("BACKEND_ROLE");

    uint256 public constant MIN_LOCK_PERIOD = 30 days;

    struct Goal {
        uint256 id;
        address creator;
        address vault; // SupplierVault address
        uint256 targetAmount; // in vault asset units (0 = open-ended quicksave)
        uint256 targetDate;   // unix timestamp
        string metadataURI;
        uint256 createdAt;
        bool cancelled;
        bool completed;
    }

    struct Attachment {
        address owner;
        uint256 depositId;
        uint256 attachedAt;
        bool pledged;
    }

    uint256 private _goalCounter;
    mapping(uint256 => Goal) public goals;
    mapping(uint256 => Attachment[]) private _attachments;
    mapping(bytes32 => uint256) public depositToGoal; // keccak(vault, owner, depositId) => goalId

    // quicksave mapping: vault => user => goalId
    mapping(address => mapping(address => uint256)) public quicksaveGoalOf;

    // notifier whitelist (e.g., SupplierVault addresses allowed to call autoAttachToQuicksave)
    mapping(address => bool) public notifiers;

    // attachment caps to bound gas
    uint256 public maxAttachmentsPerGoal;
    uint256 public maxAttachmentsPerUser;

    bool public attachmentsPaused;
    bool public creationPaused;

    ILeaderboard public leaderboard;

    // Events
    event GoalCreated(uint256 indexed goalId, address indexed creator, address indexed vault, uint256 targetAmount, uint256 targetDate, string metadataURI);
    event DepositAttached(uint256 indexed goalId, address indexed owner, uint256 indexed depositId, uint256 attachedAt);
    event DepositDetached(uint256 indexed goalId, address indexed owner, uint256 indexed depositId, uint256 detachedAt);
    event AttachmentPledged(uint256 indexed goalId, address indexed owner, uint256 indexed depositId);
    event GoalCompleted(uint256 indexed goalId, uint256 completedAt, uint256 totalValue);
    event GoalCancelled(uint256 indexed goalId);
    event CreationPaused(bool paused);
    event AttachmentsPaused(bool paused);
    event ConfigUpdated(uint256 maxAttachmentsPerGoal, uint256 maxAttachmentsPerUser);
    event NotifierUpdated(address indexed notifier, bool allowed);
    event LeaderboardSet(address leaderboard);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin, uint256 _maxPerGoal, uint256 _maxPerUser) external initializer {
        require(admin != address(0), "Invalid admin");
        __AccessControl_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        _grantRole(ADMIN_ROLE, admin);
        _grantRole(KEEPER_ROLE, admin);

        _goalCounter = 1;
        maxAttachmentsPerGoal = _maxPerGoal == 0 ? 200 : _maxPerGoal;
        maxAttachmentsPerUser = _maxPerUser == 0 ? 500 : _maxPerUser;

        creationPaused = false;
        attachmentsPaused = false;

        emit ConfigUpdated(maxAttachmentsPerGoal, maxAttachmentsPerUser);
    }

    function _authorizeUpgrade(address) internal override onlyRole(ADMIN_ROLE) {}

    // ------------------------
    // Admin
    // ------------------------

    function setCreationPaused(bool paused) external onlyRole(ADMIN_ROLE) {
        creationPaused = paused;
        emit CreationPaused(paused);
    }

    function setAttachmentsPaused(bool paused) external onlyRole(ADMIN_ROLE) {
        attachmentsPaused = paused;
        emit AttachmentsPaused(paused);
    }

    function updateAttachmentLimits(uint256 perGoal, uint256 perUser) external onlyRole(ADMIN_ROLE) {
        require(perGoal > 0 && perUser > 0, "Invalid limits");
        maxAttachmentsPerGoal = perGoal;
        maxAttachmentsPerUser = perUser;
        emit ConfigUpdated(perGoal, perUser);
    }

    function setNotifier(address addr, bool allowed) external onlyRole(ADMIN_ROLE) {
        require(addr != address(0), "Invalid notifier");
        notifiers[addr] = allowed;
        emit NotifierUpdated(addr, allowed);
    }

    function setLeaderboard(address leaderboardAddr) external onlyRole(ADMIN_ROLE) {
        leaderboard = ILeaderboard(leaderboardAddr);
        emit LeaderboardSet(leaderboardAddr);
    }

    // ------------------------
    // Goal lifecycle
    // ------------------------

    function createGoal(address vault, uint256 targetAmount, uint256 targetDate, string calldata metadataURI) external nonReentrant returns (uint256 goalId) {
        require(!creationPaused, "Creation paused");
        require(vault != address(0), "Invalid vault");
        require(targetAmount >= 0, "Invalid target");
        // targetDate 0 means open-ended; otherwise must be at least MIN_LOCK_PERIOD in future
        require(targetDate == 0 || targetDate >= block.timestamp + MIN_LOCK_PERIOD, "Target too soon");

        goalId = _goalCounter++;
        Goal storage g = goals[goalId];
        g.id = goalId;
        g.creator = msg.sender;
        g.vault = vault;
        g.targetAmount = targetAmount;
        g.targetDate = targetDate == 0 ? block.timestamp + MIN_LOCK_PERIOD : targetDate;
        g.metadataURI = metadataURI;
        g.createdAt = block.timestamp;
        g.cancelled = false;
        g.completed = false;

        emit GoalCreated(goalId, msg.sender, vault, g.targetAmount, g.targetDate, metadataURI);
    }

    /**
     * @notice Called by a trusted notifier (e.g., SupplierVault) to auto-attach a new deposit into the user's quicksave goal.
     * If quicksave doesn't exist it is created for user (creator = user).
     */
    function autoAttachToQuicksave(address user, address vault, uint256 depositId) external {
        require(notifiers[msg.sender], "Not authorized notifier");
        require(user != address(0), "Invalid user");
        require(vault != address(0), "Invalid vault");

        uint256 quickId = quicksaveGoalOf[vault][user];
        if (quickId == 0) {
            quickId = _createQuicksaveFor(user, vault);
        }

        _attachDepositOnBehalf(quickId, user, depositId);
    }

    /**
     * @notice Backend attaches deposits on behalf of users for group goals.
     */
    function attachDepositsOnBehalf(uint256 goalId, address owner, uint256[] calldata depositIds) external onlyRole(BACKEND_ROLE) nonReentrant {
        require(!attachmentsPaused, "Attachments paused");
        Goal storage g = goals[goalId];
        require(g.id != 0 && !g.cancelled && !g.completed, "Invalid goal");
        require(block.timestamp <= g.targetDate, "Goal window passed");
        require(depositIds.length > 0, "No deposits");

        Attachment[] storage arr = _attachments[goalId];
        require(arr.length + depositIds.length <= maxAttachmentsPerGoal, "Goal attachment cap");

        ISupplierVaultMinimal vault = ISupplierVaultMinimal(g.vault);

        uint256 userCount = 0;
        for (uint256 i = 0; i < arr.length; i++) {
            if (arr[i].owner == owner) userCount++;
        }
        require(userCount + depositIds.length <= maxAttachmentsPerUser, "Per-user cap for this goal");

        for (uint256 i = 0; i < depositIds.length; i++) {
            uint256 depositId = depositIds[i];
            (, uint256 currentValue, , uint256 lockEnd, ) = vault.getUserDeposit(owner, depositId);
            require(currentValue > 0, "Deposit not found or zero");
            require(lockEnd >= block.timestamp, "Deposit already unlocked");

            bytes32 key = _depositKey(g.vault, owner, depositId);
            require(depositToGoal[key] == 0, "Deposit already attached");

            Attachment memory a = Attachment({ owner: owner, depositId: depositId, attachedAt: block.timestamp, pledged: vault.isDepositPledged(owner, depositId) });
            arr.push(a);
            depositToGoal[key] = goalId;

            emit DepositAttached(goalId, owner, depositId, block.timestamp);

            if (address(leaderboard) != address(0)) {
                try leaderboard.recordDeposit(owner, currentValue) {} catch {}
            }
        }
    }

    /**
     * @notice Attach multiple deposits by owner to a goal.
     */
    function attachDeposits(uint256 goalId, uint256[] calldata depositIds) external nonReentrant {
        require(!attachmentsPaused, "Attachments paused");
        Goal storage g = goals[goalId];
        require(g.id != 0 && !g.cancelled && !g.completed, "Invalid goal");
        require(block.timestamp <= g.targetDate, "Goal window passed");
        require(depositIds.length > 0, "No deposits");

        Attachment[] storage arr = _attachments[goalId];
        require(arr.length + depositIds.length <= maxAttachmentsPerGoal, "Goal attachment cap");

        ISupplierVaultMinimal vault = ISupplierVaultMinimal(g.vault);

        uint256 userCount = 0;
        for (uint256 i = 0; i < arr.length; i++) {
            if (arr[i].owner == msg.sender) userCount++;
        }
        require(userCount + depositIds.length <= maxAttachmentsPerUser, "Per-user cap for this goal");

        for (uint256 i = 0; i < depositIds.length; i++) {
            uint256 depositId = depositIds[i];
            (, uint256 currentValue, , uint256 lockEnd, ) = vault.getUserDeposit(msg.sender, depositId);
            require(currentValue > 0, "Deposit not found or zero");
            require(lockEnd >= block.timestamp, "Deposit already unlocked");

            bytes32 key = _depositKey(g.vault, msg.sender, depositId);
            require(depositToGoal[key] == 0, "Deposit already attached");

            Attachment memory a = Attachment({ owner: msg.sender, depositId: depositId, attachedAt: block.timestamp, pledged: vault.isDepositPledged(msg.sender, depositId) });
            arr.push(a);
            depositToGoal[key] = goalId;

            emit DepositAttached(goalId, msg.sender, depositId, block.timestamp);

            if (address(leaderboard) != address(0)) {
                try leaderboard.recordDeposit(msg.sender, currentValue) {} catch {}
            }
        }
    }

    /**
     * @notice Transfer an attached deposit between two goals owned by the same user.
     * Both goals must be same vault.
     */
    function transferDeposit(uint256 fromGoalId, uint256 toGoalId, uint256 depositId) external nonReentrant {
        require(fromGoalId != toGoalId, "Same goal");
        Goal storage fromG = goals[fromGoalId];
        Goal storage toG = goals[toGoalId];
        require(fromG.id != 0 && toG.id != 0, "Invalid goal");
        require(fromG.vault == toG.vault, "Different vaults");
        require(!toG.cancelled && !toG.completed && !fromG.cancelled && !fromG.completed, "Invalid goal state");

        Attachment[] storage fromArr = _attachments[fromGoalId];
        uint256 idx = type(uint256).max;
        for (uint256 i = 0; i < fromArr.length; i++) {
            if (fromArr[i].owner == msg.sender && fromArr[i].depositId == depositId) {
                idx = i;
                break;
            }
        }
        require(idx != type(uint256).max, "Not attached to fromGoal");

        Attachment storage a = fromArr[idx];
        require(!a.pledged, "Attachment pledged");

        Attachment[] storage toArr = _attachments[toGoalId];
        require(toArr.length + 1 <= maxAttachmentsPerGoal, "Target goal cap");

        ISupplierVaultMinimal vault = ISupplierVaultMinimal(fromG.vault);
        (, uint256 currentValue, , uint256 lockEnd, ) = vault.getUserDeposit(msg.sender, depositId);
        require(currentValue > 0, "Deposit not found");
        require(lockEnd >= block.timestamp, "Deposit locked");

        // remove from fromArr
        bytes32 fromKey = _depositKey(fromG.vault, msg.sender, depositId);
        depositToGoal[fromKey] = 0;
        uint256 tail = fromArr.length - 1;
        if (idx != tail) {
            fromArr[idx] = fromArr[tail];
        }
        fromArr.pop();

        // add to target
        Attachment memory newA = Attachment({ owner: msg.sender, depositId: depositId, attachedAt: block.timestamp, pledged: vault.isDepositPledged(msg.sender, depositId) });
        toArr.push(newA);
        bytes32 toKey = _depositKey(toG.vault, msg.sender, depositId);
        depositToGoal[toKey] = toGoalId;

        emit DepositDetached(fromGoalId, msg.sender, depositId, block.timestamp);
        emit DepositAttached(toGoalId, msg.sender, depositId, block.timestamp);
    }

    /**
     * @notice Detach multiple attachments (descending indices) owned by caller.
     */
    function detachAttachments(uint256 goalId, uint256[] calldata indices) external nonReentrant {
        Goal storage g = goals[goalId];
        require(g.id != 0, "Invalid goal");
        Attachment[] storage arr = _attachments[goalId];
        require(indices.length > 0, "No indices");

        ISupplierVaultMinimal vault = ISupplierVaultMinimal(g.vault);

        for (uint256 k = 0; k < indices.length; k++) {
            require(indices[k] < arr.length, "Index OOB");
            if (k > 0) require(indices[k] < indices[k-1], "Indices not descending");
        }

        for (uint256 i = 0; i < indices.length; i++) {
            uint256 idx = indices[i];
            Attachment storage a = arr[idx];
            require(a.owner == msg.sender, "Not owner");
            require(!a.pledged, "Attachment pledged");
            (, , , uint256 lockEnd, ) = vault.getUserDeposit(a.owner, a.depositId);
            require(g.cancelled || block.timestamp >= lockEnd, "Deposit locked");

            bytes32 key = _depositKey(g.vault, a.owner, a.depositId);
            depositToGoal[key] = 0;

            uint256 tail = arr.length - 1;
            if (idx != tail) arr[idx] = arr[tail];
            arr.pop();

            emit DepositDetached(goalId, msg.sender, a.depositId, block.timestamp);
        }
    }

    /**
     * @notice Report that an attached deposit was pledged in the SupplierVault/Bridge.
     */
    function reportPledgedAttachment(uint256 goalId, uint256 depositId) external nonReentrant {
        Goal storage g = goals[goalId];
        require(g.id != 0, "Invalid goal");
        Attachment[] storage arr = _attachments[goalId];
        bool found = false;
        ISupplierVaultMinimal vault = ISupplierVaultMinimal(g.vault);

        for (uint256 i = 0; i < arr.length; i++) {
            Attachment storage a = arr[i];
            if (a.owner == msg.sender && a.depositId == depositId) {
                require(vault.isDepositPledged(msg.sender, depositId), "Not pledged in vault");
                if (!a.pledged) {
                    a.pledged = true;
                    emit AttachmentPledged(goalId, msg.sender, depositId);
                }
                found = true;
                break;
            }
        }
        require(found, "Attachment not found");
    }

    /**
     * @notice Cancel a goal (creator or admin) if no pledged attachments exist.
     */
    function cancelGoal(uint256 goalId) external nonReentrant {
        Goal storage g = goals[goalId];
        require(g.id != 0, "Invalid goal");
        require(!g.cancelled, "Already cancelled");
        require(msg.sender == g.creator || hasRole(ADMIN_ROLE, msg.sender), "Not permitted");

        Attachment[] storage arr = _attachments[goalId];
        ISupplierVaultMinimal vault = ISupplierVaultMinimal(g.vault);
        for (uint256 i = 0; i < arr.length; i++) {
            require(!arr[i].pledged, "Has pledged attachments");
            require(!vault.isDepositPledged(arr[i].owner, arr[i].depositId), "Has pledged attachments");
        }

        g.cancelled = true;
        emit GoalCancelled(goalId);
    }

    // ------------------------
    // Keeper / Finalization
    // ------------------------

    function finalizeGoalIfCompleted(uint256 goalId) external nonReentrant {
        require(hasRole(KEEPER_ROLE, msg.sender) || hasRole(ADMIN_ROLE, msg.sender), "Not allowed");
        Goal storage g = goals[goalId];
        require(g.id != 0 && !g.completed && !g.cancelled, "Invalid goal");

        (uint256 totalValue, ) = _computeGoalValuePaged(g, 0, _attachments[goalId].length);
        if (g.targetAmount > 0 && totalValue >= g.targetAmount) {
            g.completed = true;
            emit GoalCompleted(goalId, block.timestamp, totalValue);
            if (address(leaderboard) != address(0)) {
                try leaderboard.recordGoalCompletion(g.creator, goalId, totalValue) {} catch {}
            }
        } else {
            revert("Not completed or no target");
        }
    }

    // ------------------------
    // Views (paged)
    // ------------------------

    function attachmentCount(uint256 goalId) external view returns (uint256) {
        return _attachments[goalId].length;
    }

    function attachmentAt(uint256 goalId, uint256 index) external view returns (Attachment memory) {
        require(index < _attachments[goalId].length, "Index OOB");
        return _attachments[goalId][index];
    }

    function getGoalProgressPaged(uint256 goalId, uint256 start, uint256 end) external view returns (uint256 totalValue, uint256 percentBps) {
        Goal storage g = goals[goalId];
        require(g.id != 0, "Invalid goal");
        require(start <= end, "Invalid range");
        (uint256 sum, ) = _computeGoalValuePaged(g, start, end);
        totalValue = sum;
        if (g.targetAmount == 0) {
            percentBps = 0;
        } else {
            percentBps = (sum * 10000) / g.targetAmount;
        }
    }

    function getGoalProgressFull(uint256 goalId) external view returns (uint256 totalValue, uint256 percentBps) {
        Goal storage g = goals[goalId];
        require(g.id != 0, "Invalid goal");
        (uint256 sum, ) = _computeGoalValuePaged(g, 0, _attachments[goalId].length);
        totalValue = sum;
        if (g.targetAmount == 0) percentBps = 0;
        else percentBps = (sum * 10000) / g.targetAmount;
    }

    function getQuicksaveGoal(address vault, address user) external view returns (uint256) {
        return quicksaveGoalOf[vault][user];
    }

    // ------------------------
    // Internal helpers
    // ------------------------

    function _createQuicksaveFor(address user, address vault) internal returns (uint256 goalId) {
        goalId = _goalCounter++;
        Goal storage g = goals[goalId];
        g.id = goalId;
        g.creator = user;
        g.vault = vault;
        g.targetAmount = 0; // open-ended
        g.targetDate = block.timestamp + MIN_LOCK_PERIOD;
        g.metadataURI = "quicksave";
        g.createdAt = block.timestamp;
        g.cancelled = false;
        g.completed = false;

        quicksaveGoalOf[vault][user] = goalId;
        emit GoalCreated(goalId, user, vault, g.targetAmount, g.targetDate, g.metadataURI);
    }

    function _attachDepositOnBehalf(uint256 goalId, address owner, uint256 depositId) internal {
        Goal storage g = goals[goalId];
        require(g.id != 0 && !g.cancelled && !g.completed, "Invalid goal");

        Attachment[] storage arr = _attachments[goalId];
        require(arr.length + 1 <= maxAttachmentsPerGoal, "Goal cap");

        uint256 userCount = 0;
        for (uint256 i = 0; i < arr.length; i++) {
            if (arr[i].owner == owner) userCount++;
        }
        require(userCount + 1 <= maxAttachmentsPerUser, "Per-user cap");

        ISupplierVaultMinimal vault = ISupplierVaultMinimal(g.vault);

        (, uint256 currentValue, , uint256 lockEnd, ) = vault.getUserDeposit(owner, depositId);
        require(currentValue > 0, "Deposit not found or zero");
        require(lockEnd >= block.timestamp, "Deposit already unlocked");

        bytes32 key = _depositKey(g.vault, owner, depositId);
        require(depositToGoal[key] == 0, "Deposit already attached");

        Attachment memory a = Attachment({ owner: owner, depositId: depositId, attachedAt: block.timestamp, pledged: vault.isDepositPledged(owner, depositId) });
        arr.push(a);
        depositToGoal[key] = goalId;

        emit DepositAttached(goalId, owner, depositId, block.timestamp);

        if (address(leaderboard) != address(0)) {
            try leaderboard.recordDeposit(owner, currentValue) {} catch {}
        }
    }

    function _computeGoalValuePaged(Goal storage g, uint256 start, uint256 end) internal view returns (uint256 sum, uint256 counted) {
        Attachment[] storage arr = _attachments[g.id];
        uint256 len = arr.length;
        if (start >= len) return (0, 0);
        if (end > len) end = len;
        ISupplierVaultMinimal vault = ISupplierVaultMinimal(g.vault);

        for (uint256 i = start; i < end; i++) {
            Attachment storage a = arr[i];
            (, uint256 currentValue, , , ) = vault.getUserDeposit(a.owner, a.depositId);
            sum += currentValue;
            counted++;
        }
    }

    function _depositKey(address vault, address owner, uint256 depositId) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(vault, owner, depositId));
    }
}