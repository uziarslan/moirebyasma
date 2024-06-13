const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    products: [
        {
            product: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Product',
            },
            size: String,
            quantity: Number,
            orderNote: String,
        },
    ],
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    orderDate: {
        type: Date,
        default: Date.now,
    },
    totalPrice: Number,
    newOrder: {
        type: Boolean,
        default: true,
    },
    paymentMethod: {
        type: String,
    },
    trackingId: {
        type: String,
    },
}, { toJSON: { virtuals: true } });

orderSchema.virtual('formattedOrderDate').get(function () {
    const options = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    };
    return this.orderDate.toLocaleDateString('en-US', options);
});

module.exports = mongoose.model('Order', orderSchema);
