// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/*
 * @title SimpleDEX
 * @dev A simple decentralized exchange using constant product AMM (x * y = k)
 */
contract SimpleDEX is ERC20, ReentrancyGuard, Ownable {
    
    // Trading fee: 0.3% (represented as 3/1000)
    uint256 public constant FEE_NUMERATOR = 3;
    uint256 public constant FEE_DENOMINATOR = 1000;
    
    // Token addresses in the pool
    IERC20 public tokenA;
    IERC20 public tokenB;
    
    // Token reserves
    uint256 public reserveA;
    uint256 public reserveB;
    
    // Events
    event LiquidityAdded(
        address indexed provider,
        uint256 amountA,
        uint256 amountB,
        uint256 liquidity
    );
    
    event LiquidityRemoved(
        address indexed provider,
        uint256 amountA,
        uint256 amountB,
        uint256 liquidity
    );
    
    event Swap(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );
    
    /**
     * @dev Constructor to initialize the DEX with two tokens
     * @param _tokenA Address of first token
     * @param _tokenB Address of second token
     */
    constructor(
        address _tokenA,
        address _tokenB
    ) ERC20("SimpleDEX LP Token", "SDEX-LP") Ownable(msg.sender) {
        require(_tokenA != address(0) && _tokenB != address(0), "Invalid token addresses");
        require(_tokenA != _tokenB, "Tokens must be different");
        
        tokenA = IERC20(_tokenA);
        tokenB = IERC20(_tokenB);
    }
    
    /**
     * @dev Add liquidity to the pool
     * @param amountA Amount of tokenA to add
     * @param amountB Amount of tokenB to add
     * @return liquidity LP tokens minted
     */
    function addLiquidity(
        uint256 amountA,
        uint256 amountB
    ) external nonReentrant returns (uint256 liquidity) {
        require(amountA > 0 && amountB > 0, "Amounts must be greater than 0");
        
        // Transfer tokens from user to contract
        require(
            tokenA.transferFrom(msg.sender, address(this), amountA),
            "TokenA transfer failed"
        );
        require(
            tokenB.transferFrom(msg.sender, address(this), amountB),
            "TokenB transfer failed"
        );
        
        // Calculate liquidity tokens to mint
        uint256 _totalSupply = totalSupply();
        
        if (_totalSupply == 0) {
            // First liquidity provider
            liquidity = sqrt(amountA * amountB);
            require(liquidity > 0, "Insufficient liquidity minted");
        } else {
            // Subsequent liquidity providers
            // Liquidity proportional to existing pool
            uint256 liquidityA = (amountA * _totalSupply) / reserveA;
            uint256 liquidityB = (amountB * _totalSupply) / reserveB;
            liquidity = liquidityA < liquidityB ? liquidityA : liquidityB;
            require(liquidity > 0, "Insufficient liquidity minted");
        }
        
        // Mint LP tokens to user
        _mint(msg.sender, liquidity);
        
        // Update reserves
        reserveA += amountA;
        reserveB += amountB;
        
        emit LiquidityAdded(msg.sender, amountA, amountB, liquidity);
    }
    
    /**
     * @dev Remove liquidity from the pool
     * @param liquidity Amount of LP tokens to burn
     * @return amountA Amount of tokenA returned
     * @return amountB Amount of tokenB returned
     */
    function removeLiquidity(
        uint256 liquidity
    ) external nonReentrant returns (uint256 amountA, uint256 amountB) {
        require(liquidity > 0, "Liquidity must be greater than 0");
        require(balanceOf(msg.sender) >= liquidity, "Insufficient LP tokens");
        
        uint256 _totalSupply = totalSupply();
        
        // Calculate token amounts to return
        amountA = (liquidity * reserveA) / _totalSupply;
        amountB = (liquidity * reserveB) / _totalSupply;
        
        require(amountA > 0 && amountB > 0, "Insufficient liquidity burned");
        
        // Burn LP tokens
        _burn(msg.sender, liquidity);
        
        // Update reserves
        reserveA -= amountA;
        reserveB -= amountB;
        
        // Transfer tokens back to user
        require(tokenA.transfer(msg.sender, amountA), "TokenA transfer failed");
        require(tokenB.transfer(msg.sender, amountB), "TokenB transfer failed");
        
        emit LiquidityRemoved(msg.sender, amountA, amountB, liquidity);
    }
    
    /**
     * @dev Swap tokenA for tokenB
     * @param amountAIn Amount of tokenA to swap
     * @param minAmountBOut Minimum amount of tokenB to receive (slippage protection)
     * @return amountBOut Amount of tokenB received
     */
    function swapAForB(
        uint256 amountAIn,
        uint256 minAmountBOut
    ) external nonReentrant returns (uint256 amountBOut) {
        require(amountAIn > 0, "Amount must be greater than 0");
        require(reserveA > 0 && reserveB > 0, "Insufficient liquidity");
        
        // Calculate output amount using constant product formula
        amountBOut = getAmountOut(amountAIn, reserveA, reserveB);
        require(amountBOut >= minAmountBOut, "Slippage tolerance exceeded");
        require(amountBOut < reserveB, "Insufficient reserve");
        
        // Transfer tokenA from user to contract
        require(
            tokenA.transferFrom(msg.sender, address(this), amountAIn),
            "TokenA transfer failed"
        );
        
        // Update reserves
        reserveA += amountAIn;
        reserveB -= amountBOut;
        
        // Transfer tokenB to user
        require(tokenB.transfer(msg.sender, amountBOut), "TokenB transfer failed");
        
        emit Swap(msg.sender, address(tokenA), address(tokenB), amountAIn, amountBOut);
    }
    
    /**
     * @dev Swap tokenB for tokenA
     * @param amountBIn Amount of tokenB to swap
     * @param minAmountAOut Minimum amount of tokenA to receive (slippage protection)
     * @return amountAOut Amount of tokenA received
     */
    function swapBForA(
        uint256 amountBIn,
        uint256 minAmountAOut
    ) external nonReentrant returns (uint256 amountAOut) {
        require(amountBIn > 0, "Amount must be greater than 0");
        require(reserveA > 0 && reserveB > 0, "Insufficient liquidity");
        
        // Calculate output amount using constant product formula
        amountAOut = getAmountOut(amountBIn, reserveB, reserveA);
        require(amountAOut >= minAmountAOut, "Slippage tolerance exceeded");
        require(amountAOut < reserveA, "Insufficient reserve");
        
        // Transfer tokenB from user to contract
        require(
            tokenB.transferFrom(msg.sender, address(this), amountBIn),
            "TokenB transfer failed"
        );
        
        // Update reserves
        reserveB += amountBIn;
        reserveA -= amountAOut;
        
        // Transfer tokenA to user
        require(tokenA.transfer(msg.sender, amountAOut), "TokenA transfer failed");
        
        emit Swap(msg.sender, address(tokenB), address(tokenA), amountBIn, amountAOut);
    }
    
    /**
     * @dev Calculate output amount using constant product formula with fees
     * @param amountIn Input token amount
     * @param reserveIn Input token reserve
     * @param reserveOut Output token reserve
     * @return amountOut Output token amount
     */
    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) public pure returns (uint256 amountOut) {
        require(amountIn > 0, "Insufficient input amount");
        require(reserveIn > 0 && reserveOut > 0, "Insufficient liquidity");
        
        // Apply 0.3% fee
        uint256 amountInWithFee = amountIn * (FEE_DENOMINATOR - FEE_NUMERATOR);
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * FEE_DENOMINATOR) + amountInWithFee;
        amountOut = numerator / denominator;
    }
    
    /**
     * @dev Get current price of tokenA in terms of tokenB
     * @return price Price ratio (reserveB / reserveA)
     */
    function getPriceAInB() external view returns (uint256 price) {
        require(reserveA > 0, "No liquidity");
        price = (reserveB * 1e18) / reserveA;
    }
    
    /**
     * @dev Get current price of tokenB in terms of tokenA
     * @return price Price ratio (reserveA / reserveB)
     */
    function getPriceBInA() external view returns (uint256 price) {
        require(reserveB > 0, "No liquidity");
        price = (reserveA * 1e18) / reserveB;
    }
    
    /**
     * @dev Get pool reserves
     * @return _reserveA Reserve of tokenA
     * @return _reserveB Reserve of tokenB
     */
    function getReserves() external view returns (uint256 _reserveA, uint256 _reserveB) {
        _reserveA = reserveA;
        _reserveB = reserveB;
    }
    
   
    function sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }

}
