const express = require('express');
const router = express();
const mongoose = require('mongoose');
const Category = mongoose.model('Category');
const Product = mongoose.model('Product');
const User = mongoose.model('User');
const Order = mongoose.model('Order');
const wrapAsync = require('../../utils/wrapAsync');

// Render the homepage
router.get('/', async (req, res) => {
    const category = await Category.find({}).populate('products');
    res.render('./pages/index', { category, cart: req.session.cart });
});

// Rendering all the products in 1 category
router.get('/category/:categoryId/all/products', wrapAsync(async (req, res) => {
    const { categoryId } = req.params;
    const { cart } = req.session;
    const category = await Category.find({});
    const specificCategory = await Category.findById(categoryId).populate('products');
    res.render('./pages/categoryproducts', { cart, category, specificCategory });
}))

// Render the product showpage
router.get('/product/:productId', wrapAsync(async (req, res) => {
    const { productId } = req.params;
    // finding a product
    const product = await Product.findById(productId);
    // Getting all the categories and populating it
    const category = await Category.find({}).populate('products');
    // Defining the variables
    let suggestion = [];
    const { cart } = req.session;
    let disableBtn = false;
    // You may like suggestions logic
    for (let cat of category) {
        for (let prod of cat.products) {
            if (suggestion.length !== 4) {
                if (prod._id.toString() !== productId) {
                    suggestion.push(prod);
                }
            }
        }
    }
    // Check if the product is already in the cart
    if (cart !== undefined) {
        for (let cartProduct of cart) {
            if (cartProduct._id === productId) {
                disableBtn = true;
            }
        }
    }
    let categoryName = '';
    // Finding the category name of the product
    for (let cat of category) {
        for (let prod of cat.products) {
            if (prod._id.toString() === productId) {
                categoryName = cat.categoryName;
                break;
            }
        }
    }
    res.render('./pages/showpage', { product, categoryName, category, suggestion, cart, disableBtn });
}));


// Adding product to the session (Cart)
router.post('/add/product/cart/:productId', wrapAsync(async (req, res) => {
    const { productId } = req.params;
    const { qty, size } = req.body;
    let cart = req.session.cart || [];
    // Find the product in the database using the provided productId
    const product = await Product.findById(productId);
    if (product) {
        const index = cart.findIndex(item => item._id === productId && item.size === size);
        if (index !== -1) {
            // If the product already exists in the cart, update the quantity
            cart[index].qty = parseInt(cart[index].qty) + parseInt(qty);
        } else {
            // If the product does not exist in the cart, add it
            cart.push({ ...product.toObject(), qty, size });
        }
        req.session.cart = cart;
        res.redirect(`/product/${productId}`);
    }
}));





// Rendering the cart page
router.get('/cart', async (req, res) => {
    const { cart } = req.session;
    const category = await Category.find({});
    res.render('./pages/cart', { cart, category });
});

// Updating the cart Quantity
router.post('/refresh/cart/:productId', (req, res) => {
    const { productId } = req.params;
    const { qty, size } = req.body;
    const { cart } = req.session;
    cart.map((product) => {
        if (product._id === productId && product.size === size) {
            product.qty = qty;
        }
    })
    res.redirect('/cart');
});

// Adding an Order Note to session
router.post('/checkout/submit', (req, res) => {
    const { note } = req.body;
    const { cart } = req.session;
    req.session.cart = cart.map(product => ({ ...product, orderNote: note }));
    res.redirect('/checkout')
});

// rendering the Signup page
router.get('/checkout', (req, res) => {
    const { cart } = req.session;
    res.render('./pages/userinfo', { cart });
});

// Deleting product from the cart
router.get('/delete/:productId', (req, res) => {
    const { cart } = req.session;
    const { productId } = req.params;
    const { size } = req.query;
    // filter out only the product with the specified productId and size
    const updateCart = cart.filter(product => product._id !== productId || product.size !== size);
    req.session.cart = updateCart;
    res.redirect('/cart');
});


// Rendering the payment page with user info
router.get('/payment/method', (req, res) => {
    const { cart } = req.session;
    const { user } = req;
    res.render('./pages/payment', { cart, user });
});

// Edit user info
router.get('/edit/user/:userId', async (req, res) => {
    const { userId } = req.params;
    const user = await User.findById(userId);
    const { cart } = req.session
    res.render('./pages/edituser', { user, cart })
});

// Handling the edit user request
router.put('/signup/:userId', wrapAsync(async (req, res) => {
    const { userId } = req.params;
    const user = await User.findByIdAndUpdate(userId, { ...req.body });
    res.redirect('/payment/method');
}));

// Rendering the confirm payment method
router.get('/payment', (req, res) => {
    const { cart } = req.session;
    const { user } = req;
    res.render('./pages/paymentmethod', { cart, user });
});

router.get('/order/confirm/:oderId', wrapAsync(async (req, res) => {
    const category = await Category.find({});
    res.render('./pages/orderpage', { category })
}))

router.post('/order/confirm', wrapAsync(async (req, res) => {
    const products = req.session.cart.map((item) => ({
        product: item._id,
        size: item.size,
        quantity: item.qty,
        orderNote: item.orderNote,
    }));

    // Update the stock quantity for each product and size in the order
    for (const item of req.session.cart) {
        const product = await Product.findById(item._id);
        const size = product.size.find((s) => s.name === item.size);

        if (size) {
            size.stockQty -= item.qty;
            await product.save();
        }
    }

    const order = new Order({
        products,
        user: req.user._id,
        totalPrice: req.session.cart.reduce((total, item) => total + item.price, 0),
        paymentMethod: req.body.paymentMethod,
    });

    await order.save();
    req.session.cart = [];
    res.redirect('/');
}));

module.exports = router;