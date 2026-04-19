const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  const filePath = path.join(__dirname, 'index.html');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  fs.createReadStream(filePath).pipe(res);
});

server.listen(3333, () => {
  console.log('Server running on http://localhost:3333');
});
