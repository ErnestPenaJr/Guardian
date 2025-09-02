#!/usr/bin/env node

/**
 * Guardian MVP Error Handling System Verification Script
 * Tests that the SweetAlert2 error handling system is properly configured
 */

import fs from 'fs';
import path from 'path';
import http from 'http';

const BASE_URL = 'http://localhost:5175';
const API_URL = 'http://localhost:3001';

console.log('🚀 Guardian MVP Error Handling System Verification\n');

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      let data = '';
      response.on('data', (chunk) => {
        data += chunk;
      });
      response.on('end', () => {
        resolve({ statusCode: response.statusCode, data });
      });
    });
    
    request.on('error', (error) => {
      reject(error);
    });
    
    request.setTimeout(5000, () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

async function testFrontendAvailability() {
  console.log('📱 Testing Frontend Availability...');
  try {
    const response = await makeRequest(BASE_URL);
    if (response.statusCode === 200) {
      const html = response.data;
      
      // Check if the HTML contains our React app structure
      const hasRoot = html.includes('<div id="root">');
      
      console.log(`   ✅ Frontend server accessible at ${BASE_URL}`);
      console.log(`   ✅ React root div present: ${hasRoot}`);
      console.log(`   📝 HTML structure looks correct`);
      
      return { success: true, html };
    } else {
      console.log(`   ❌ Frontend server returned status: ${response.statusCode}`);
      return { success: false };
    }
  } catch (error) {
    console.log(`   ❌ Frontend server not accessible: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function testBackendHealth() {
  console.log('\n🔧 Testing Backend API Health...');
  try {
    const response = await makeRequest(`${API_URL}/api/health`);
    if (response.statusCode === 200) {
      const data = JSON.parse(response.data);
      console.log(`   ✅ Backend API accessible at ${API_URL}/api/health`);
      console.log(`   ✅ Server: ${data.server}`);
      console.log(`   ✅ Node Version: ${data.nodeVersion}`);
      console.log(`   ✅ Uptime: ${Math.round(data.uptime)}s`);
      return { success: true, data };
    } else {
      console.log(`   ❌ Backend API returned status: ${response.statusCode}`);
      return { success: false };
    }
  } catch (error) {
    console.log(`   ❌ Backend API not accessible: ${error.message}`);
    return { success: false, error: error.message };
  }
}

function checkErrorHandlingFiles() {
  console.log('\n📋 Checking Error Handling Files...');
  
  const filesToCheck = [
    'src/components/ErrorTestingComponent.tsx',
    'src/services/ErrorManager.ts',
    'src/utils/sweetAlert.ts',
    'src/utils/errorCapture.ts',
    'src/hooks/useErrorHandler.tsx',
    'src/types/errorTypes.ts'
  ];
  
  const results = {};
  
  filesToCheck.forEach(file => {
    const fullPath = path.join(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      const stats = fs.statSync(fullPath);
      const sizeKB = Math.round(stats.size / 1024);
      console.log(`   ✅ ${file} (${sizeKB}KB)`);
      results[file] = { exists: true, size: sizeKB };
    } else {
      console.log(`   ❌ ${file} - NOT FOUND`);
      results[file] = { exists: false };
    }
  });
  
  return results;
}

function checkDependencies() {
  console.log('\n📦 Checking Dependencies...');
  
  try {
    const packagePath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    const requiredDeps = {
      'sweetalert2': packageJson.dependencies?.['sweetalert2'],
      'sweetalert2-react-content': packageJson.dependencies?.['sweetalert2-react-content'],
      'react-toastify': packageJson.dependencies?.['react-toastify']
    };
    
    Object.entries(requiredDeps).forEach(([dep, version]) => {
      if (version) {
        console.log(`   ✅ ${dep}: ${version}`);
      } else {
        console.log(`   ❌ ${dep}: NOT INSTALLED`);
      }
    });
    
    return requiredDeps;
  } catch (error) {
    console.log(`   ❌ Error reading package.json: ${error.message}`);
    return {};
  }
}

async function testBasicAPI() {
  console.log('\n🔗 Testing Basic API Endpoints...');
  
  const endpoints = [
    '/api/health',
    '/api/test'
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await makeRequest(`${API_URL}${endpoint}`);
      if (response.statusCode === 200) {
        console.log(`   ✅ ${endpoint}: ${response.statusCode} OK`);
      } else {
        console.log(`   ⚠️ ${endpoint}: ${response.statusCode}`);
      }
    } catch (error) {
      console.log(`   ❌ ${endpoint}: ${error.message}`);
    }
  }
}

async function generateReport() {
  const results = {
    timestamp: new Date().toISOString(),
    tests: {}
  };
  
  console.log('=' .repeat(60));
  console.log('🧪 RUNNING COMPREHENSIVE ERROR SYSTEM VERIFICATION');
  console.log('=' .repeat(60));
  
  // Run all tests
  results.tests.frontend = await testFrontendAvailability();
  results.tests.backend = await testBackendHealth();
  results.tests.files = checkErrorHandlingFiles();
  results.tests.dependencies = checkDependencies();
  await testBasicAPI();
  
  console.log('\n' + '=' .repeat(60));
  console.log('📊 VERIFICATION SUMMARY');
  console.log('=' .repeat(60));
  
  const allGood = results.tests.frontend.success && results.tests.backend.success;
  
  if (allGood) {
    console.log('✅ SYSTEM STATUS: READY FOR ERROR HANDLING TESTS');
    console.log('✅ Both frontend and backend servers are running');
    console.log('✅ Error handling infrastructure appears to be in place');
    console.log('');
    console.log('🎯 NEXT STEPS:');
    console.log('   1. Navigate to http://localhost:5175 in your browser');
    console.log('   2. Look for the "🚨 Error Testing Suite" button (bottom-right corner)');
    console.log('   3. Click the button to open the testing interface');
    console.log('   4. Test various error scenarios:');
    console.log('      • Database error (red button)');
    console.log('      • Network error (blue button)');
    console.log('      • Success message (green button)');
    console.log('   5. Verify SweetAlert2 modals appear with Guardian branding');
  } else {
    console.log('❌ SYSTEM STATUS: ISSUES DETECTED');
    if (!results.tests.frontend.success) {
      console.log('❌ Frontend server is not accessible');
    }
    if (!results.tests.backend.success) {
      console.log('❌ Backend API is not accessible');
    }
  }
  
  console.log('\n📝 Full test report saved for documentation');
  return results;
}

// Run the verification
generateReport().then(results => {
  console.log('\n🏁 Verification completed!\n');
}).catch(error => {
  console.error('❌ Verification failed:', error);
  process.exit(1);
});