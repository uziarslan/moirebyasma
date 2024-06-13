const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    images: [
        {
            filename: String,
            path: String
        }
    ],
    productName: String,
    price: Number,
    size: [
        {
            name: String,
            stockQty: Number
        }
    ],
    color: [String],
    fabric: [String],
    description: String,
    note: String
});

module.exports = mongoose.model('Product', productSchema);
