// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Project
 * @dev Factory contract for creating and managing DEX projects and custom tokens
 */
contract Project is Ownable, ReentrancyGuard {
    
    // Project structure
    struct ProjectInfo {
        string name;
        string symbol;
        address tokenAddress;
        address creator;
        uint256 createdAt;
        uint256 totalSupply;
        bool isActive;
    }

    // Mapping: project ID => ProjectInfo
    mapping(uint256 => ProjectInfo) public projects;
    
    // Mapping: token address => project ID
    mapping(address => uint256) public tokenToProject;
    
    // Mapping: creator => array of project IDs
    mapping(address => uint256[]) public creatorProjects;
    
    // Total number of projects created
    uint256 public projectCount;
    
    // DEX contract address
    address public dexContract;
    
    // Minimum token supply for new projects
    uint256 public constant MIN_SUPPLY = 1000 * 10**18;
    uint256 public constant MAX_SUPPLY = 1000000000 * 10**18; // 1 billion

    // Events
    event ProjectCreated(uint256 indexed projectId, string name, string symbol, address tokenAddress, address creator);
    event ProjectDeactivated(uint256 indexed projectId);
    event ProjectReactivated(uint256 indexed projectId);
    event DEXContractUpdated(address oldAddress, address newAddress);

    constructor(address _dexContract) Ownable(msg.sender) {
        require(_dexContract != address(0), "Invalid DEX address");
        dexContract = _dexContract;
    }

    /**
     * @dev Create a new project with custom ERC20 token
     * @param name Token name
     * @param symbol Token symbol
     * @param initialSupply Initial token supply (in wei)
     */
    function createProject(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) external nonReentrant returns (uint256 projectId, address tokenAddress) {
        require(bytes(name).length > 0, "Name cannot be empty");
        require(bytes(symbol).length > 0, "Symbol cannot be empty");
        require(initialSupply >= MIN_SUPPLY, "Supply too low");
        require(initialSupply <= MAX_SUPPLY, "Supply too high");

        // Create new ERC20 token
        ProjectToken newToken = new ProjectToken(name, symbol, initialSupply, msg.sender);
        tokenAddress = address(newToken);

        // Generate project ID
        projectId = projectCount;
        projectCount++;

        // Store project info
        projects[projectId] = ProjectInfo({
            name: name,
            symbol: symbol,
            tokenAddress: tokenAddress,
            creator: msg.sender,
            createdAt: block.timestamp,
            totalSupply: initialSupply,
            isActive: true
        });

        // Update mappings
        tokenToProject[tokenAddress] = projectId;
        creatorProjects[msg.sender].push(projectId);

        emit ProjectCreated(projectId, name, symbol, tokenAddress, msg.sender);
    }

    /**
     * @dev Get project details by ID
     */
    function getProject(uint256 projectId) external view returns (
        string memory name,
        string memory symbol,
        address tokenAddress,
        address creator,
        uint256 createdAt,
        uint256 totalSupply,
        bool isActive
    ) {
        require(projectId < projectCount, "Project does not exist");
        ProjectInfo memory project = projects[projectId];
        return (
            project.name,
            project.symbol,
            project.tokenAddress,
            project.creator,
            project.createdAt,
            project.totalSupply,
            project.isActive
        );
    }

    /**
     * @dev Get all projects created by an address
     */
    function getCreatorProjects(address creator) external view returns (uint256[] memory) {
        return creatorProjects[creator];
    }

    /**
     * @dev Get project ID from token address
     */
    function getProjectByToken(address tokenAddress) external view returns (uint256) {
        require(tokenToProject[tokenAddress] > 0 || tokenAddress == projects[0].tokenAddress, "Token not found");
        return tokenToProject[tokenAddress];
    }

    /**
     * @dev Deactivate a project (creator or owner only)
     */
    function deactivateProject(uint256 projectId) external {
        require(projectId < projectCount, "Project does not exist");
        ProjectInfo storage project = projects[projectId];
        require(msg.sender == project.creator || msg.sender == owner(), "Not authorized");
        require(project.isActive, "Project already inactive");

        project.isActive = false;
        emit ProjectDeactivated(projectId);
    }

    /**
     * @dev Reactivate a project (creator or owner only)
     */
    function reactivateProject(uint256 projectId) external {
        require(projectId < projectCount, "Project does not exist");
        ProjectInfo storage project = projects[projectId];
        require(msg.sender == project.creator || msg.sender == owner(), "Not authorized");
        require(!project.isActive, "Project already active");

        project.isActive = true;
        emit ProjectReactivated(projectId);
    }

    /**
     * @dev Update DEX contract address (owner only)
     */
    function updateDEXContract(address newDexContract) external onlyOwner {
        require(newDexContract != address(0), "Invalid address");
        address oldAddress = dexContract;
        dexContract = newDexContract;
        emit DEXContractUpdated(oldAddress, newDexContract);
    }

    /**
     * @dev Get all active projects
     */
    function getActiveProjects() external view returns (uint256[] memory) {
        uint256 activeCount = 0;
        
        // Count active projects
        for (uint256 i = 0; i < projectCount; i++) {
            if (projects[i].isActive) {
                activeCount++;
            }
        }

        // Create array of active project IDs
        uint256[] memory activeProjects = new uint256[](activeCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < projectCount; i++) {
            if (projects[i].isActive) {
                activeProjects[index] = i;
                index++;
            }
        }

        return activeProjects;
    }

    /**
     * @dev Check if a token is registered
     */
    function isTokenRegistered(address tokenAddress) external view returns (bool) {
        uint256 projectId = tokenToProject[tokenAddress];
        if (projectId == 0 && tokenAddress != projects[0].tokenAddress) {
            return false;
        }
        return projects[projectId].isActive;
    }
}

/**
 * @title ProjectToken
 * @dev ERC20 token for DEX projects
 */
contract ProjectToken is ERC20 {
    address public projectFactory;
    address public creator;

    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        address _creator
    ) ERC20(name, symbol) {
        projectFactory = msg.sender;
        creator = _creator;
        _mint(_creator, initialSupply);
    }

    /**
     * @dev Get token info
     */
    function getTokenInfo() external view returns (
    string memory tokenName,
    string memory tokenSymbol,
    uint256 tokenTotalSupply,
    address tokenCreator
) {
    return (name(), symbol(), totalSupply(), creator);
}

}
