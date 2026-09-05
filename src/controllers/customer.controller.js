const Customer = require("../models/Customer");

exports.createCustomer = async (req, res) => {

    try {

        const customer = await Customer.create(req.body);

        res.status(201).json(customer);

    } catch (error) {

        res.status(500).json({
            error: error.message
        });

    }

};