const express = require('express');
const path = require('path');
const app = express();
const PORT = 8000;

// Set MIME type for .wasm files
app.use((req, res, next) => {
  if (req.path.endsWith('.wasm')) {
    res.type('application/wasm');
  }
  next();
});

// Serve static files
app.use(express.static(path.join(__dirname)));

app.listen(PORT, () => {
  console.log(`Server running at http://127.0.0.1:${PORT}`);
  console.log(`Serving from: ${__dirname}`);
});
