// SPDX-License-Identifier: MIT
// Author: 0xth3gh05t0fw1nt3r
// Purpose: Extension of MiniLend to support Mento stablecoins with automatic USDC conversion on Celo Mainnet
pragma solidity ^0.8.24;

// This contract allows users to deposit, withdraw, and swap stablecoins using Mento SortedOracles for price feeds.
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface ISortedOracles {
    function getMedianRate(address token) external view returns (uint256 rate, uint256 timestamp);
}

interface IMiniLend {
    function isStablecoinSupported(address token) external view returns (bool);
}

contract MiniMentoSwapStables is ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public immutable sortedOracles;
    address public immutable miniLend;
    address[] public stablecoins;
    mapping(address => uint256) public balances;
    mapping(address => mapping(address => uint256)) public userBalances;

    uint256 public constant MAX_TOKENS = 50;
    uint256 public constant MAX_PRICE_AGE = 1 hours;

    event Deposit(address indexed user, address indexed token, uint256 amount);
    event Withdrawal(address indexed user, address indexed token, uint256 amount);
    event StablecoinAdded(address indexed token);
    event StablecoinApprovalFailed(address indexed token, bytes errorData);
    event Swapped(address indexed user, address indexed fromToken, address indexed toToken, uint256 input, uint256 output);

    constructor(address _sortedOracles, address _miniLend) {
        require(_sortedOracles != address(0) && _miniLend != address(0), "Invalid address");
        sortedOracles = _sortedOracles;
        miniLend = _miniLend;

        address[18] memory initialStablecoins = [
            0x765DE816845861e75A25fCA122bb6898B8B1282a, // cUSD
            0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e, // USDT
            0xcebA9300f2b948710d2653dD7B07f33A8B32118C, // USDC
            0x4F604735c1cF31399C6E711D5962b2B3E0225AD3, // USDGLO
            0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73, // cEUR
            0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787, // cREAL
            0x73F93dcc49cB8A239e2032663e9475dd5ef29A08, // eXOF
            0x456a3D042C0DbD3db53D5489e98dFb038553B0d0, // cKES
            0x105d4A9306D2E55a71d2Eb95B81553AE1dC20d7B, // PUSO
            0x8A567e2aE79CA692Bd748aB832081C45de4041eA, // cCOP
            0xfAeA5F3404bbA20D3cc2f8C4B0A888F55a3c7313, // cGHS
            0xCCF663b1fF11028f0b19058d0f7B674004a40746, // cGBP
            0x4c35853A3B4e647fD266f4de678dCc8fEC410BF6, // cZAR
            0xff4Ab19391af240c311c54200a492233052B6325, // cCAD
            0x7175504C455076F15c04A2F90a8e352281F492F9, // cAUD
            0xb55a79F398E759E43C95b979163f30eC87Ee131D, // cCHF
            0xc45eCF20f3CD864B32D9794d6f76814aE8892e20, // cJPY
            0xE2702Bd97ee33c88c8f6f92DA3B733608aa76F71  // cNGN
        ];

        for (uint256 i = 0; i < initialStablecoins.length; i++) {
            if (initialStablecoins[i] != address(0)) {
                stablecoins.push(initialStablecoins[i]);
                emit StablecoinAdded(initialStablecoins[i]);
            }
        }
    }

    function deposit(address token, uint256 amount) external nonReentrant {
        require(isStablecoin(token), "Not a supported stablecoin");
        require(amount > 0, "Amount must be greater than 0");
        require(IERC20(token).allowance(msg.sender, address(this)) >= amount, "Insufficient allowance");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        balances[token] += amount;
        userBalances[msg.sender][token] += amount;

        if (IMiniLend(miniLend).isStablecoinSupported(token)) {
            IERC20(token).safeIncreaseAllowance(miniLend, amount);
        }

        emit Deposit(msg.sender, token, amount);
    }

    function withdraw(address token, uint256 amount) external nonReentrant {
        require(isStablecoin(token), "Not a supported stablecoin");
        require(amount > 0, "Amount must be greater than 0");
        require(userBalances[msg.sender][token] >= amount, "Insufficient balance");

        userBalances[msg.sender][token] -= amount;
        balances[token] -= amount;
        IERC20(token).safeTransfer(msg.sender, amount);

        emit Withdrawal(msg.sender, token, amount);
    }

    function swapStablecoins(address fromToken, address toToken, uint256 amountIn) external nonReentrant returns (uint256 amountOut) {
        require(isStablecoin(fromToken) && isStablecoin(toToken), "Not supported stablecoins");
        require(amountIn > 0, "Amount must be greater than 0");
        require(IERC20(fromToken).allowance(msg.sender, address(this)) >= amountIn, "Insufficient allowance");

        uint256 priceFrom = getCELOPrice(fromToken);
        uint256 priceTo = getCELOPrice(toToken);
        amountOut = (amountIn * priceFrom) / priceTo;
        require(amountOut > 0, "Invalid output amount");

        IERC20(fromToken).safeTransferFrom(msg.sender, address(this), amountIn);
        balances[fromToken] += amountIn;
        userBalances[msg.sender][fromToken] += amountIn;

        require(balances[toToken] >= amountOut, "Insufficient liquidity");
        balances[toToken] -= amountOut;
        userBalances[msg.sender][toToken] -= amountOut;
        IERC20(toToken).safeTransfer(msg.sender, amountOut);

        emit Swapped(msg.sender, fromToken, toToken, amountIn, amountOut);
    }

    function addMentoStablecoin(address token) external {
        require(token != address(0), "Invalid address");
        require(stablecoins.length < MAX_TOKENS, "Max tokens reached");
        require(!isStablecoin(token), "Stablecoin already added");

        (bool success, bytes memory data) = token.staticcall(abi.encodeWithSignature("balanceOf(address)", address(this)));
        require(success && data.length > 0, "Invalid ERC20 token");

        stablecoins.push(token);
        emit StablecoinAdded(token);
    }

    function isStablecoin(address token) public view returns (bool) {
        for (uint256 i = 0; i < stablecoins.length; i++) {
            if (stablecoins[i] == token) return true;
        }
        return false;
    }

    function getCELOPrice(address token) internal view returns (uint256 celoPerToken) {
        (uint256 rate, uint256 timestamp) = ISortedOracles(sortedOracles).getMedianRate(token);
        require(rate > 0 && block.timestamp <= timestamp + MAX_PRICE_AGE, "Price unavailable");
        return rate;
    }

    function getLatestPrice(address token) external view returns (uint256) {
        return getCELOPrice(token);
    }
}