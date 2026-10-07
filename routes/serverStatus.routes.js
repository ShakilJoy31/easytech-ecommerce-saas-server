const { getServerStatus, toggleServerStatus } = require("../controller/serverStatus.controller");

const router = require("express").Router();

// Get server status
router.get("/", getServerStatus);

// Toggle server status (on/off)
router.get("/toggle", toggleServerStatus);

module.exports = router;



