const express = require("express");
const router = express.Router();
const { createCustomer } = require("../controllers/customer.controller");

router.post("/", createCustomer);

module.exports = router;