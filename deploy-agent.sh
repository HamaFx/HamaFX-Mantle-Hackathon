#!/bin/bash
set -e

echo "=== Mantle Alpha Agent Deployment ==="
echo ""
echo "To deploy the smart contract on-chain, the agent wallet requires Testnet MNT."
echo "Since the faucet requires a human to solve a CAPTCHA and connect Twitter/Discord,"
echo "you need to manually claim the tokens before running the deploy step."
echo ""
echo "1. Go to the faucet: https://faucet.testnet.mantle.xyz/"
echo "2. Request funds for this agent address: 0xF73BA9f4Fc94F4B648B10FBBc6dE9a708519D3D0"
echo ""
read -p "Press Enter once you have successfully claimed the testnet MNT... "

echo ""
echo "Deploying MantleAlphaLogger Smart Contract to Mantle Sepolia..."
cd contracts
npx hardhat run scripts/deploy.cjs --network mantleSepolia

if [ ! -f "deployed-address.json" ]; then
    echo "Deployment failed! Did the faucet fund the wallet?"
    exit 1
fi

ADDRESS=$(grep -o '"address":"[^"]*"' deployed-address.json | cut -d'"' -f4)

echo ""
echo "✅ Contract deployed at: $ADDRESS"
echo "Updating ../.env.local..."

cd ..
# Update the placeholder in .env.local with the real address
sed -i "s/MANTLE_ALPHA_LOGGER_ADDRESS=\"\"/MANTLE_ALPHA_LOGGER_ADDRESS=\"$ADDRESS\"/" .env.local

echo ""
echo "🎉 Done! The HamaFX Alpha Agent is fully set up for the Mantle Hackathon."
echo "You can now run 'pnpm dev' and test the agent at http://localhost:3000"
