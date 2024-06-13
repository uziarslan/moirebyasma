if (process.env.NODE_ENV !== "production") {
    require('dotenv').config();
}
require('./models/categorySchema');
require('./models/orderSchema');
require('./models/productSchema');
require('./models/userSchema');
require('./models/adminSchema');
const express = require('express');
const app = express();
const ejsMate = require('ejs-mate');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const mongoose = require('mongoose');
const User = mongoose.model('User');
const Admin = mongoose.model('Admin');
const MongoDBStore = require('connect-mongo');
const passport = require('passport');
const localStrategy = require('passport-local');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const homepageRoutes = require('./routes/homepageRoutes/homepageRoutes');
const adminRoutes = require('./routes/adminRoutes');
const loginRoutes = require('./routes/loginRoutes');
const ExpressError = require('./utils/ExpressError');
const { category } = require('./data/index');

// Varibales
const PORT = 3000;
const mongoURi = 'mongodb://localhost:27017/moirebyasma';
const secret = 'thisisnotagoodsecret';
const store = new MongoDBStore({
    mongoUrl: mongoURi,
    secret,
    touchAfter: 24 * 60 * 60
});
const sessionConfig = {
    store,
    secret,
    name: "session",
    resave: false,
    saveUninitialized: false
};



// Setting up the app
app.engine('ejs', ejsMate);
app.set('view engine', 'ejs');
app.set(path.join(__dirname, 'views'));

// Using the app
app.use(express.static(__dirname + '/public'));
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(session(sessionConfig));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
app.use((req, res, next) => {
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    next();
});

// inititalizing Passport
passport.use('user', new localStrategy(User.authenticate()));
passport.use('admin', new localStrategy(Admin.authenticate()));
passport.serializeUser((user, done) => {
    if (user instanceof User) {
        done(null, { type: 'user', id: user.id });
    } else if (user instanceof Admin) {
        done(null, { type: 'admin', id: user.id });
    }
});
passport.deserializeUser(async (data, done) => {
    try {
        let user;
        if (data.type === 'user') {
            user = await User.findById(data.id);
        } else if (data.type === 'admin') {
            user = await Admin.findById(data.id);
        }
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});



// Route handler
app.use(homepageRoutes);
app.use(loginRoutes);
app.use(adminRoutes);


// initializing Mongoose
mongoose.connect(mongoURi, { useNewUrlParser: true, useUnifiedTopology: true }).then(() => {
    console.log('Mongoose is connected')
}).catch((e) => {
    console.log(e)
});


// handling the error message
app.all("*", (req, res, next) => {
    next(new ExpressError('Page not found', 404));
});
app.use((err, req, res, next) => {
    const { status = 500 } = err;
    const { cart } = req.session;
    if (!err.message) err.message = "Oh No, Something Went Wrong!";
    res.status(status).render('error', { err, cart, category });
});

// Listen for the port Number
app.listen(PORT, () => {
    console.log(`App is listening on http://localhost:${PORT}`);
});