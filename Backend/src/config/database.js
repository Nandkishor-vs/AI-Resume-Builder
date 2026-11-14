
const mongoose = require("mongoose")

async function dbconnect() {
    await mongoose.connect(process.env.MONGO_URI)
    console.log("database Connected");
}

module.exports = dbconnect