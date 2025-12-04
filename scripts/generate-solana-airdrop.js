#!/usr/bin/env node
/**
 * Generate Solana airdrop list
 * Generate 111 valid Solana addresses and random amounts
 */

const { Keypair } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

// Configuration
const COUNT = 111;
const MIN_AMOUNT = 0.01;
const MAX_AMOUNT = 100;

/**
 * Generate random amount (between 0.01 and 100, with 2 decimal places)
 */
function generateRandomAmount() {
  const amount = Math.random() * (MAX_AMOUNT - MIN_AMOUNT) + MIN_AMOUNT;
  return amount.toFixed(2);
}

/**
 * Generate airdrop list
 */
function generateAirdropList() {
  console.log(`🚀 Starting to generate ${COUNT} Solana addresses and amounts...`);

  const airdropList = [];

  for (let i = 0; i < COUNT; i++) {
    // Generate random Keypair
    const keypair = Keypair.generate();
    const address = keypair.publicKey.toBase58();
    const amount = generateRandomAmount();

    airdropList.push({ address, amount });

    // Show progress
    if ((i + 1) % 20 === 0) {
      console.log(`✓ Generated ${i + 1}/${COUNT} addresses`);
    }
  }

  return airdropList;
}

/**
 * Save to CSV file
 */
function saveToCSV(airdropList, filename) {
  const csvContent = [
    'address,amount',
    ...airdropList.map(item => `${item.address},${item.amount}`)
  ].join('\n');

  const outputPath = path.join(__dirname, filename);
  fs.writeFileSync(outputPath, csvContent, 'utf-8');

  console.log(`\n✅ Saved to: ${outputPath}`);
  console.log(`📊 Total: ${airdropList.length} addresses`);

  // Calculate total amount
  const totalAmount = airdropList.reduce((sum, item) => sum + parseFloat(item.amount), 0);
  console.log(`💰 Total amount: ${totalAmount.toFixed(2)}`);
}

/**
 * Main function
 */
function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📝 Solana Airdrop List Generator');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const airdropList = generateAirdropList();
  saveToCSV(airdropList, 'solana-airdrop-list.csv');

  // Show first 5 examples
  console.log('\n📋 First 5 address examples:');
  airdropList.slice(0, 5).forEach((item, index) => {
    console.log(`  ${index + 1}. ${item.address} - ${item.amount}`);
  });

  console.log('\n✨ Completed!');
}

// Run
main();
