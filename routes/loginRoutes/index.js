const express = require('express');
const router = express();
const { category } = require('../../data/index');
const passport = require('passport');
const mongoose = require('mongoose');
const User = mongoose.model('User');
const wrapAsync = require('../../utils/wrapAsync');


// Rendering the login Page
router.get('/user/login', (req, res) => {
    const { cart } = req.session;
    res.render('./pages/login', { category, cart });
});

// Handling the login request
router.post('/login', (req, res, next) => {
    // Store the cart data temporarily
    const tempCart = req.session.cart;
    passport.authenticate('user', { failureRedirect: '/user/login' }, (err, user, info) => {
        if (err) {
            return next(err);
        }
        if (!user) {
            // Setup flash and call it here if needed
            req.flash('error', 'Incorrect Username or Password')
            return res.redirect('/user/login');
        }
        req.logIn(user, (err) => {
            if (err) {
                return next(err);
            }
            // Restore the cart data
            req.session.cart = tempCart;

            if (req.session.cart === undefined) {
                return res.redirect('/');
            } else {
                return res.redirect('/payment/method');
            }
        });
    })(req, res, next);
});


// Handling the new user request
router.post('/signup', wrapAsync(async (req, res, next) => {
    const { username, password } = req.body;
    const tempCart = req.session.cart;
    const foundUser = await User.find({ username });
    if (foundUser.length) {
        // Setup flash and call it here
        req.flash('error', 'Email already in use. Try different Email or Login instead.')
        return res.redirect('/checkout')
    }
    const user = new User({ ...req.body });
    const registeredUser = await User.register(user, password, function (err, newUser) {
        if (err) {
            next(err);
        }
        req.logIn(newUser, () => {
            req.session.cart = tempCart;
            res.redirect('/payment/method');
        })
    });
}))

module.exports = router;