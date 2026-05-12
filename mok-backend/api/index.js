// api/index.js
// Vercel looks for files inside /api folder for serverless functions.
// This file simply re-exports the Express app from server.js
module.exports = require('../server.js');

