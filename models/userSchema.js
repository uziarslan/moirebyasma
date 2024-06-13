const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose');

const userSchema = new mongoose.Schema({
    username: String,
    firstName: String,
    lastName: String,
    country: String,
    address: String,
    otherAddress: String,
    city: String,
    postalCode: String,
    contact: String
});

userSchema.plugin(passportLocalMongoose)

module.exports = mongoose.model('User', userSchema);