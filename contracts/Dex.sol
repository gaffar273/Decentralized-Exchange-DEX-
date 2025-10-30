// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/*
 * @title SimpleDEX
 * @dev Basic AMM DEX using constant product formula (x * y = k)
 */
contract DEX is ReentrancyGuard {
    
    // Pool structure
    struct Pool {
        address token0;
        address token1;
        uint256 reserve0;
        uint256 reserve1;
        uint256 totalLiquidity;
    }
    
    mapping(bytes32 => Pool) public pools;
    mapping(bytes32 => mapping(address => uint256)) public liquidity;
    
    uint256 public constant FEE_PERCENT = 3; // 0.3% fee
    uint256 public constant FEE_DENOMINATOR = 1000;
    
    // Events
    event PoolCreated(address indexed token0, address indexed token1, bytes32 poolId);
    event LiquidityAdded(bytes32 indexed poolId, address indexed provider, uint256 amount0, uint256 amount1, uint256 liquidity);
    event LiquidityRemoved(bytes32 indexed poolId, address indexed provider, uint256 amount0, uint256 amount1, uint256 liquidity);
    event Swap(bytes32 indexed poolId, address indexed user, address tokenIn, uint256 amountIn, uint256 amountOut);
    
    /**
     * @dev Create a new liquidity pool
     */
    function createPool(address token0, address token1) external returns (bytes32) {
        require(token0 != token1, "Identical tokens");
        require(token0 != address(0) && token1 != address(0), "Zero address");
        
        // Sort tokens
        (address tokenA, address tokenB) = token0 < token1 ? (token0, token1) : (token1, token0);
        bytes32 poolId = keccak256(abi.encodePacked(tokenA, tokenB));
        
        require(pools[poolId].token0 == address(0), "Pool exists");
        
        pools[poolId] = Pool({
            token0: tokenA,
            token1: tokenB,
            reserve0: 0,
            reserve1: 0,
            totalLiquidity: 0
        });
        
        emit PoolCreated(tokenA, tokenB, poolId);
        return poolId;
    }
    
    /**
     * @dev Add liquidity to pool
     */
    function addLiquidity(
        address token0,
        address token1,
        uint256 amount0,
        uint256 amount1
    ) external nonReentrant returns (uint256) {
        require(amount0 > 0 && amount1 > 0, "Invalid amounts");
        
        bytes32 poolId = getPoolId(token0, token1);
        Pool storage pool = pools[poolId];
        require(pool.token0 != address(0), "Pool doesn't exist");
        
        // Transfer tokens
        IERC20(pool.token0).transferFrom(msg.sender, address(this), amount0);
        IERC20(pool.token1).transferFrom(msg.sender, address(this), amount1);
        
        uint256 liquidityMinted;
        if (pool.totalLiquidity == 0) {
            liquidityMinted = sqrt(amount0 * amount1);
        } else {
            liquidityMinted = min(
                (amount0 * pool.totalLiquidity) / pool.reserve0,
                (amount1 * pool.totalLiquidity) / pool.reserve1
            );
        }
        
        require(liquidityMinted > 0, "Insufficient liquidity minted");
        
        pool.reserve0 += amount0;
        pool.reserve1 += amount1;
        pool.totalLiquidity += liquidityMinted;
        liquidity[poolId][msg.sender] += liquidityMinted;
        
        emit LiquidityAdded(poolId, msg.sender, amount0, amount1, liquidityMinted);
        return liquidityMinted;
    }
    
    /**
     * @dev Remove liquidity from pool
     */
    function removeLiquidity(
        address token0,
        address token1,
        uint256 liquidityAmount
    ) external nonReentrant returns (uint256 amount0, uint256 amount1) {
        bytes32 poolId = getPoolId(token0, token1);
        Pool storage pool = pools[poolId];
        
        require(liquidity[poolId][msg.sender] >= liquidityAmount, "Insufficient liquidity");
        
        amount0 = (liquidityAmount * pool.reserve0) / pool.totalLiquidity;
        amount1 = (liquidityAmount * pool.reserve1) / pool.totalLiquidity;
        
        require(amount0 > 0 && amount1 > 0, "Insufficient amounts");
        
        liquidity[poolId][msg.sender] -= liquidityAmount;
        pool.totalLiquidity -= liquidityAmount;
        pool.reserve0 -= amount0;
        pool.reserve1 -= amount1;
        
        IERC20(pool.token0).transfer(msg.sender, amount0);
        IERC20(pool.token1).transfer(msg.sender, amount1);
        
        emit LiquidityRemoved(poolId, msg.sender, amount0, amount1, liquidityAmount);
    }
    
    /**
     * @dev Swap tokens
     */
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) external nonReentrant returns (uint256 amountOut) {
        require(amountIn > 0, "Invalid input amount");
        
        bytes32 poolId = getPoolId(tokenIn, tokenOut);
        Pool storage pool = pools[poolId];
        require(pool.token0 != address(0), "Pool doesn't exist");
        
        bool isToken0 = tokenIn == pool.token0;
        (uint256 reserveIn, uint256 reserveOut) = isToken0 
            ? (pool.reserve0, pool.reserve1) 
            : (pool.reserve1, pool.reserve0);
        
        // Calculate output amount with fee
        amountOut = getAmountOut(amountIn, reserveIn, reserveOut);
        require(amountOut >= minAmountOut, "Slippage exceeded");
        require(amountOut < reserveOut, "Insufficient liquidity");
        
        // Transfer tokens
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).transfer(msg.sender, amountOut);
        
        // Update reserves
        if (isToken0) {
            pool.reserve0 += amountIn;
            pool.reserve1 -= amountOut;
        } else {
            pool.reserve1 += amountIn;
            pool.reserve0 -= amountOut;
        }
        
        emit Swap(poolId, msg.sender, tokenIn, amountIn, amountOut);
    }
    
    /**
     * @dev Calculate output amount using constant product formula
     */
    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) public pure returns (uint256) {
        require(amountIn > 0, "Invalid input");
        require(reserveIn > 0 && reserveOut > 0, "Insufficient liquidity");
        
        uint256 amountInWithFee = amountIn * (FEE_DENOMINATOR - FEE_PERCENT);
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * FEE_DENOMINATOR) + amountInWithFee;
        
        return numerator / denominator;
    }
    
    /**
     * @dev Get pool ID
     */
    function getPoolId(address token0, address token1) public pure returns (bytes32) {
        (address tokenA, address tokenB) = token0 < token1 ? (token0, token1) : (token1, token0);
        return keccak256(abi.encodePacked(tokenA, tokenB));
    }
    
    /**
     * @dev Square root function
     */
    function sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }
    
    /**
     * @dev Min function
     */
    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
