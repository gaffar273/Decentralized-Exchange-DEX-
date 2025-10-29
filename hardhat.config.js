require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: {
    version: "0.8.24",  // Core Testnet2 uses 0.8.24
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "shanghai"  // Core Testnet2 uses Shanghai
    },
  },
  networks: {
    core_testnet2: {
      url: "https://rpc.test2.btcs.network",
      accounts: [process.env.PRIVATE_KEY],
      chainId: 1114,
    }
  },
  etherscan: {
    apiKey: {
      core_testnet2: process.env.CORESCAN_API_KEY || "dummy"
    },
    customChains: [
      {
        network: "core_testnet2",
        chainId: 1114,
        urls: {
          apiURL: "https://api.test2.btcs.network/api",
          browserURL: "https://scan.test2.btcs.network"
        }
      }
    ]
  }
};
