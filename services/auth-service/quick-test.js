const http = require('http');

console.log('Making request to http://localhost:4001/health');

const req = http.get('http://localhost:4001/health', (res) => {
  console.log(`Status: ${res.statusCode}`);
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Response:', data);
    process.exit(0);
  });
});

req.on('error', (e) => {
  console.error(`Error: ${e.message}`);
  process.exit(1);
});

req.setTimeout(5000, () => {
  console.error('Request timed out');
  req.destroy();
  process.exit(1);
});
