#!/usr/bin/env node

/**
 * Production API Testing Script
 * 
 * This script tests the API endpoints in production to ensure they return JSON
 * instead of HTML pages, which was causing the "Start Assignment" button errors.
 * 
 * Usage:
 *   node scripts/test-production-api.js <production-url>
 * 
 * Example:
 *   node scripts/test-production-api.js https://guardian-dev.azurewebsites.net
 */

const https = require('https');
const http = require('http');

const PRODUCTION_URL = process.argv[2];

if (!PRODUCTION_URL) {
  console.error('❌ Please provide the production URL as an argument');
  console.error('Usage: node scripts/test-production-api.js <production-url>');
  process.exit(1);
}

console.log(`🔍 Testing API endpoints for: ${PRODUCTION_URL}`);
console.log('=' .repeat(60));

// Test endpoints to verify
const testEndpoints = [
  '/api/health',
  '/api/test',
  // Note: /api/requests/73/form requires authentication, so we'll test the public ones first
];

async function testEndpoint(endpoint) {
  return new Promise((resolve) => {
    const url = `${PRODUCTION_URL}${endpoint}`;
    const client = url.startsWith('https:') ? https : http;
    
    console.log(`Testing: ${endpoint}`);
    
    const req = client.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const isHTML = data.includes('<!doctype html>') || data.includes('<html');
        const isJSON = res.headers['content-type']?.includes('application/json');
        
        console.log(`  Status: ${res.statusCode}`);
        console.log(`  Content-Type: ${res.headers['content-type']}`);
        console.log(`  Is HTML: ${isHTML ? '❌ YES (BAD)' : '✅ NO (GOOD)'}`);
        console.log(`  Is JSON: ${isJSON ? '✅ YES (GOOD)' : '❌ NO (BAD)'}`);
        
        if (isJSON && !isHTML) {
          try {
            const parsed = JSON.parse(data);
            console.log(`  JSON Response: ✅ Valid`);
            console.log(`  Data Preview: ${JSON.stringify(parsed).substring(0, 100)}...`);
          } catch (e) {
            console.log(`  JSON Response: ❌ Invalid - ${e.message}`);
          }
        } else if (isHTML) {
          console.log(`  HTML Preview: ${data.substring(0, 100)}...`);
        }
        
        console.log('');
        resolve({
          endpoint,
          status: res.statusCode,
          isHTML,
          isJSON,
          success: isJSON && !isHTML && res.statusCode === 200
        });
      });
    });
    
    req.on('error', (err) => {
      console.log(`  Error: ❌ ${err.message}`);
      console.log('');
      resolve({
        endpoint,
        error: err.message,
        success: false
      });
    });
    
    req.setTimeout(10000, () => {
      console.log(`  Error: ❌ Request timeout`);
      console.log('');
      req.destroy();
      resolve({
        endpoint,
        error: 'Request timeout',
        success: false
      });
    });
  });
}

async function runTests() {
  const results = [];
  
  for (const endpoint of testEndpoints) {
    const result = await testEndpoint(endpoint);
    results.push(result);
  }
  
  console.log('📊 SUMMARY');
  console.log('=' .repeat(60));
  
  const successful = results.filter(r => r.success).length;
  const total = results.length;
  
  console.log(`✅ Successful: ${successful}/${total}`);
  console.log(`❌ Failed: ${total - successful}/${total}`);
  
  if (successful === total) {
    console.log('\n🎉 All API endpoints are working correctly!');
    console.log('The "Start Assignment" button should work in production.');
  } else {
    console.log('\n⚠️  Some API endpoints are not working correctly.');
    console.log('This may cause the "Start Assignment" button to fail in production.');
    console.log('\nFailed endpoints:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.endpoint}: ${r.error || 'Returned HTML instead of JSON'}`);
    });
  }
  
  console.log('\n💡 Next Steps:');
  console.log('1. If tests pass, the "Start Assignment" button should work');
  console.log('2. If tests fail, check server routing configuration');
  console.log('3. Verify that API routes are registered before static file serving');
  console.log('4. Check Azure App Service configuration if using Azure');
}

runTests().catch(console.error);
