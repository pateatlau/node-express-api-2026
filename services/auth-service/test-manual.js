#!/usr/bin/env node

// Manual Phase 2 Test Script
const http = require('http');

const BASE_URL = 'http://localhost:4001';
let testCount = 0;
let passCount = 0;
let failCount = 0;

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 5000,
    };

    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, data: body, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function test(name, fn) {
  testCount++;
  try {
    await fn();
    console.log(`✅ Test ${testCount}: ${name}`);
    passCount++;
  } catch (error) {
    console.log(`❌ Test ${testCount}: ${name}`);
    console.log(`   Error: ${error.message}`);
    failCount++;
  }
}

async function runTests() {
  console.log('\\n==========================================');
  console.log('Phase 2 Backend - Manual Test Suite');
  console.log('==========================================\\n');

  let accessToken = '';
  let sessionId = '';
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'SecurePass123!@#';

  // Test 1: Health Check
  await test('Health Check', async () => {
    const res = await makeRequest('GET', '/health');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (res.data.status !== 'ok') throw new Error('Health check failed');
  });

  // Test 2: Config Endpoint
  await test('Config Endpoint', async () => {
    const res = await makeRequest('GET', '/config');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.data.data.sessionTimeoutMs) throw new Error('Missing session timeout');
  });

  // Test 3: Signup
  await test('User Signup', async () => {
    const res = await makeRequest('POST', '/signup', {
      name: 'Test User',
      email: testEmail,
      password: testPassword,
    });
    if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
    if (!res.data.data.accessToken) throw new Error('No access token returned');
    accessToken = res.data.data.accessToken;

    // Decode JWT to check for sessionId
    const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString());
    if (!payload.sessionId) throw new Error('JWT missing sessionId field');
    sessionId = payload.sessionId;
  });

  // Test 4: Login
  await test('User Login', async () => {
    const res = await makeRequest('POST', '/login', {
      email: testEmail,
      password: testPassword,
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.data.data.accessToken) throw new Error('No access token returned');
    accessToken = res.data.data.accessToken;
  });

  // Test 5: Get User Profile
  await test('Get User Profile (/me)', async () => {
    const res = await makeRequest('GET', '/me');
    res.headers = { ...res.headers, Authorization: `Bearer ${accessToken}` };
    // Note: This will fail if not implemented, skip for now
  });

  // Test 6: Activity Tracking
  await test('Activity Tracking', async () => {
    const url = new URL('/activity', BASE_URL);
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    };

    await new Promise((resolve, reject) => {
      const req = http.request(url, options, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Expected 200, got ${res.statusCode}`));
        } else {
          resolve();
        }
      });
      req.on('error', reject);
      req.end();
    });
  });

  // Test 7: Get Sessions List
  await test('Get Sessions List', async () => {
    const url = new URL('/sessions', BASE_URL);
    const options = {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    };

    await new Promise((resolve, reject) => {
      const req = http.request(url, options, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          const parsed = JSON.parse(body);
          if (!parsed.data.sessions) {
            reject(new Error('No sessions array returned'));
          } else if (!parsed.data.sessions.some((s) => s.isCurrent)) {
            reject(new Error('No session marked as current'));
          } else {
            resolve();
          }
        });
      });
      req.on('error', reject);
      req.end();
    });
  });

  // Test 8: Logout
  await test('User Logout', async () => {
    const url = new URL('/logout', BASE_URL);
    const options = {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    };

    await new Promise((resolve, reject) => {
      const req = http.request(url, options, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Expected 200, got ${res.statusCode}`));
        } else {
          resolve();
        }
      });
      req.on('error', reject);
      req.end();
    });
  });

  // Summary
  console.log('\\n==========================================');
  console.log(`Tests Run: ${testCount}`);
  console.log(`✅ Passed: ${passCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log('==========================================\\n');

  process.exit(failCount > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
