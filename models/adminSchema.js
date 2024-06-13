const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose');
const adminSchema = new mongoose.Schema({
    username: String,
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    }
});

adminSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model('Admin', adminSchema)
