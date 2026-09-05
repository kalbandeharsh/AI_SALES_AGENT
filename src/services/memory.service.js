const customerRoutes =
    require("./routes/customer.routes");

app.use(
    "/api/customers",
    customerRoutes
);