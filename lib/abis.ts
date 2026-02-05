export const VAULT_ABI = [
  "function allocateOnrampDeposit(address user, uint256 amount, bytes32 txHash) external returns (uint256)",
  "function deposits(address user, uint256 index) external view returns (uint256 shares, uint256 principal, uint256 depositTime, uint256 lockEnd, bool pledgedAsCollateral)",
  "function depositCount(address user) external view returns (uint256)",
  "event OnrampDeposit(address indexed user, uint256 indexed depositId, uint256 amount, uint256 shares, bytes32 indexed txHash)",
  "event Deposited(address indexed user, uint256 indexed depositId, uint256 amount, uint256 shares, uint256 lockTier)",
] as const;

export const GOAL_MANAGER_ABI = [
  "function getQuicksaveGoal(address vault, address user) external view returns (uint256)",
  "function createGoal(address vault, uint256 targetAmount, uint256 targetDate, string calldata metadataURI) external returns (uint256)",
  "function createGoalFor(address creator, address vault, uint256 targetAmount, uint256 targetDate, string calldata metadataURI) external returns (uint256)",
  "function createQuicksaveGoalFor(address user, address vault) external returns (uint256)",
  "function attachDeposits(uint256 goalId, uint256[] calldata depositIds) external",
  "function cancelGoal(uint256 goalId) external",
  "function attachDepositsOnBehalf(uint256 goalId, address owner, uint256[] calldata depositIds) external",
  "function forceAddMember(uint256 goalId, address member) external",
  "function forceRemoveMember(uint256 goalId, address member) external",
  "function goals(uint256) external view returns (uint256 id, address creator, address vault, uint256 targetAmount, uint256 targetDate, string metadataURI, uint256 createdAt, bool cancelled, bool completed)",
  "function getGoalProgressFull(uint256 goalId) external view returns (uint256 totalValue, uint256 percentBps)",
  "function attachmentCount(uint256 goalId) external view returns (uint256)",
  "function attachmentAt(uint256 goalId, uint256 index) external view returns (tuple(address owner, uint256 depositId, uint256 attachedAt, bool pledged))",
  "function depositToGoal(bytes32 key) external view returns (uint256)",
  "event GoalCreated(uint256 indexed goalId, address indexed creator, address indexed vault, uint256 targetAmount, uint256 targetDate, string metadataURI)",
  "event DepositAttached(uint256 indexed goalId, address indexed owner, uint256 indexed depositId, uint256 attachedAt)",
  "event DepositDetached(uint256 indexed goalId, address indexed owner, uint256 indexed depositId, uint256 detachedAt)",
  "event AttachmentPledged(uint256 indexed goalId, address indexed owner, uint256 indexed depositId)",
  "event GoalCompleted(uint256 indexed goalId, uint256 completedAt, uint256 totalValue)",
  "event MemberInvited(uint256 indexed goalId, address indexed inviter, address indexed invitee)",
  "event InviteRevoked(uint256 indexed goalId, address indexed revoker, address indexed invitee)",
  "event MemberJoined(uint256 indexed goalId, address indexed member)",
  "event MemberRemoved(uint256 indexed goalId, address indexed member)",
  "event GoalCancelled(uint256 indexed goalId)",
] as const;

export const LEADERBOARD_ABI = [
  "function recordDepositOnBehalf(address user, uint256 amount) external",
  "function getUserScore(address user) external view returns (uint256)",
  "function getTopListLength() external view returns (uint256)",
  "function getTopRange(uint256 start, uint256 end) external view returns (address[] users, uint256[] userScores)",
  "function scores(address user) external view returns (uint256)",
  "function topList(uint256 index) external view returns (address)",
] as const;
