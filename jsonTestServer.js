const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');

// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint to serve JSON data
app.get('/data', (req, res) => {
  const dataFilePath = path.join(__dirname, 'data', 'output.json');
  fs.readFile(dataFilePath, 'utf8', (err, data) => {
    if (err) {
      res.status(500).send('Error reading JSON data');
    } else {
      res.json(JSON.parse(data));
    }
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
