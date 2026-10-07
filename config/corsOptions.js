const allowedOrigins = require("../config/allowedOrigin");

const corsOptions = {
  origin: function (origin, callback) {
    // Temporarily allow all origins for testing
    callback(null, true);
    
    // Original code - comment this out for now
    // if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
    //   callback(null, true);
    // } else {
    //   callback(new Error("Not allowed by CORS"));
    // }
  },
  credentials: true,
};

module.exports = corsOptions;