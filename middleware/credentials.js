const allowedOrigins = require("../config/allowedOrigin");

const credentials = (req, res, next) => {
    const origin = req.headers.origin;
    
    // console.log('Request Origin:', origin);
    // console.log('Request Path:', req.path);

    // Allow requests with no origin (server-to-server calls)
    if (!origin) {
        console.log('No origin - allowing server-to-server request');
        return next();
    }

    if (allowedOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
        res.setHeader("Access-Control-Max-Age", "1800");
        res.setHeader(
            "Access-Control-Allow-Headers",
            "Origin, X-Requested-With, Content-Type, Authorization, Accept"
        );
        res.setHeader(
            "Access-Control-Allow-Methods",
            "PUT, POST, GET, DELETE, PATCH, OPTIONS"
        );
        res.setHeader("Vary", "Origin");
    } else {
        console.log('Origin not allowed in credentials:', origin);
        // Still set headers to avoid CORS errors
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
    }

    // Handle preflight requests
    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }

    next();
};

module.exports = credentials;