const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  const factory = await ethers.getContractFactory("MantleAlphaLogger");
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log(`MantleAlphaLogger deployed to: ${address}`);
  
  fs.writeFileSync(
    "./deployed-address.json",
    JSON.stringify({ address, network: "mantleSepolia", deployedAt: new Date().toISOString() })
  );
}
main().catch(console.error);
