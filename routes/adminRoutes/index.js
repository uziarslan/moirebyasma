const express = require('express');
const router = express();
const wrapAsync = require('../../utils/wrapAsync');
const mongoose = require('mongoose');
const Admin = mongoose.model('Admin');
const Category = mongoose.model('Category');
const Product = mongoose.model('Product');
const User = mongoose.model('User');
const Order = mongoose.model('Order');
const passport = require('passport');
const { isAdmin } = require('../../middleware/index');
const multer = require('multer');
const { storage } = require('../../cloudinary');
const upload = multer({ storage });
const { uploader } = require('cloudinary').v2

const secretKey = 'hello';

// Rendering the Signup page with query parameter of SECRET
router.get('/admin/signup', (req, res) => {
    const { secret } = req.query;
    if (secret === secretKey) {
        res.render('./admin/signup')
    } else {
        res.redirect('/');
    }
});

// Rendering the login Page for Admin
router.get('/admin/login', (req, res) => {
    res.render('./admin/login')
});

// Authenticating the Login response from the user
router.post('/admin/login', passport.authenticate('admin', { failureRedirect: '/admin/login', failureFlash: { type: 'error', message: 'Invalid Email or Password' } }), (req, res) => {
    res.redirect('/admin/category');
})

// POST route for Admin Signup
router.post('/admin/signup', async (req, res, next) => {
    const { username, password } = req.body;
    const foundAdmin = await Admin.find({ username });
    if (foundAdmin.length) {
        req.flash('error', 'Admin already exists withe same Email.');
        res.redirect(`/admin/signup?secret=${secretKey}`);
    }
    const admin = new Admin({ username, role: 'admin' });
    const registeredAdmin = await Admin.register(admin, password, function (err, newAdmin) {
        if (err) {
            next(err)
        }
        req.logIn(newAdmin, () => {
            res.redirect(`/admin/category`);
        });
    });
});

// Rendering the Category Page
router.get('/admin/category', isAdmin, async (req, res) => {
    const category = await Category.find({});
    res.render('./admin/category', { category });
});

// Rendering Products in Each Category
router.get('/view/category/:categoryId', isAdmin, wrapAsync(async (req, res) => {
    const { categoryId } = req.params;
    const category = await Category.findById(categoryId).populate('products');
    res.render('./admin/viewcategory', { category });
}))

// Creating a category
router.post('/category', isAdmin, async (req, res) => {
    const { categoryName } = req.body;
    const categoryFound = await Category.find({ categoryName });
    if (categoryFound.length) {
        req.flash('error', 'Category already exsist!');
        return res.redirect('/admin/category');
    }
    const category = new Category({ categoryName });
    await category.save();
    req.flash('success', `"${categoryName}" is added!`);
    res.redirect('/admin/category');
});

// Rendering the Edit Category Page
router.get('/admin/category/:categoryId', isAdmin, async (req, res) => {
    const { categoryId } = req.params;
    const category = await Category.findById(categoryId);
    res.render('./admin/editcategory', { category });
});

// Editing the category
router.put('/category/:categoryId', isAdmin, wrapAsync(async (req, res) => {
    const { categoryId } = req.params;
    const { categoryName } = req.body;
    const category = await Category.findByIdAndUpdate(categoryId, { categoryName });
    await category.save();
    req.flash('success', "Category has been updated!");
    res.redirect('/admin/category')
}));

// Deleting the product from category
router.delete('/category/:categoryId/product/:productId', isAdmin, wrapAsync(async (req, res) => {
    const { categoryId, productId } = req.params;
    await Category.updateOne(
        { _id: categoryId },
        { $pull: { products: productId } }
    );
    req.flash('success', 'Product has been removed from the Category!')
    res.redirect(`/view/category/${categoryId}`);
}));

// Deleting the category
router.delete('/category/:categoryId', isAdmin, async (req, res) => {
    const { categoryId } = req.params;
    const categories = await Category.find({});
    if (categories.length > 1) {
        const category = await Category.findByIdAndDelete(categoryId);
        req.flash('success', `"${category.categoryName}" has been removed!`);
        return res.redirect('/admin/category')
    } else {
        req.flash('error', `Sorry! You can't delete all the categories`);
        return res.redirect('/admin/category')
    }
});

// Rendering the Create Product Page
router.get('/admin/product', isAdmin, async (req, res) => {
    const products = await Product.find({});
    const category = await Category.find({});
    res.render('./admin/product', { products, category });
});

// Creating a Product
router.post('/product', isAdmin, upload.array('images'), wrapAsync(async (req, res) => {
    const {
        productName,
        price,
        size,
        stock,
        color,
        fabric,
        description,
        note,
        categoryId
    } = req.body;

    // Create an array of objects for the 'size' field
    const sizes = size.split(',').map((name, index) => (
        { name: name.trim(), stockQty: parseInt(stock.split(',')[index].trim()) }
    ));

    // Create a new product using the schema
    const product = new Product({
        images: req.files.map(file => ({
            filename: file.filename,
            path: file.path
        })),
        productName,
        price: parseFloat(price),
        size: sizes,
        color: color ? color.split(',').map(color => color.trim()) : [],
        fabric: fabric ? fabric.split(',').map(fabric => fabric.trim()) : [],
        description,
        note
    });

    if (categoryId && categoryId.trim() !== "") {
        const category = await Category.findById(categoryId);
        category.products.push(product._id);
        await category.save();
    }

    // Save the product to the database
    await product.save();
    req.flash('success', 'Product has been added');
    res.redirect('/admin/product');
}));


// Rendering the Product Edit page
router.get('/admin/product/:productId/edit', isAdmin, wrapAsync(async (req, res) => {
    const { productId } = req.params;
    const product = await Product.findById(productId);
    const category = await Category.find({ products: { $ne: productId } });
    const productInCategory = await Category.findOne({ products: productId });

    // Extract size names
    const size = product.size.map(sizeObj => sizeObj.name).join(',');

    // Join fabric and color arrays
    const fabric = product.fabric.join(',');
    const color = product.color.join(',');

    // Extract stock quantities
    const stock = product.size.map(sizeObj => sizeObj.stockQty).join(',');

    res.render('./admin/editproduct', { product, category, size, fabric, color, stock, productInCategory });
}));



// Handling the Product Edit Request
router.put('/product/:id', isAdmin, upload.array('images'), wrapAsync(async (req, res) => {
    const { id } = req.params;
    const { categoryId, productName, price, description, note, size, stock } = req.body;
    const product = await Product.findById(id);

    // Delete old images from Cloudinary
    if (req.files.length > 0) {
        for (const image of product.images) {
            await uploader.destroy(image.filename);
        }
        product.images = req.files.map(file => ({ filename: file.filename, path: file.path }));
    }

    // Update product fields
    product.productName = productName;
    product.price = price;
    product.size = size.split(',').map((name, index) => (
        { name: name.trim(), stockQty: parseInt(stock.split(',')[index].trim()) }
    ));
    product.fabric = req.body.fabric.split(',').map(fabric => fabric.trim());
    product.color = req.body.color.split(',').map(color => color.trim());
    product.description = description;
    product.note = note;

    if (categoryId && categoryId.trim() !== "") {
        const category = await Category.findById(categoryId);
        if (!category.products.includes(product._id)) {
            category.products.push(product._id);
            await category.save();
        }
    }

    await product.save();
    req.flash('success', 'Product has been updated');
    res.redirect('/admin/product');
}));


// Deleting a Product
router.delete('/product/:productId', isAdmin, wrapAsync(async (req, res) => {
    const { productId } = req.params;
    // Find the product
    const product = await Product.findById(productId);
    if (!product) {
        req.flash('error', 'Product not found');
        return res.redirect('/admin/product');
    }
    // Delete the images from Cloudinary
    for (const image of product.images) {
        const publicId = image.filename;
        await uploader.destroy(publicId);
    }
    // Remove the product from the category
    await Category.updateMany(
        { products: productId },
        { $pull: { products: productId } }
    );
    // Remove the product from the Product collection
    await Product.findByIdAndDelete(productId);
    // Redirect the user back to the admin product page
    req.flash('success', 'Product Deleted Successfully')
    res.redirect('/admin/product');
}));

// Deleting a single image from cloudinary and the database
router.delete('/product/:productId/image/:filename', isAdmin, wrapAsync(async (req, res) => {
    const { productId } = req.params;
    const filename = decodeURIComponent(req.params.filename);
    // Find the product by ID
    const product = await Product.findById(productId);
    if (product.images.length > 1) {
        // Find the image by filename
        const image = product.images.find(img => img.filename === filename);
        if (image) {
            // Remove the image from Cloudinary
            await uploader.destroy(image.filename);
            // Remove the image from the product's images array
            product.images = product.images.filter(img => img.filename !== filename);
            // Save the updated product
            await product.save();
            // Redirect or send a success message
            req.flash('success', 'Image has been removed Successfully.');
            return res.redirect(`/admin/product/${productId}/edit`);
        }
    } else {
        req.flash('error', "Sorry! There should be atleast 1 image remain to showcase")
        return res.redirect(`/admin/product/${productId}/edit`);
    }
}));


// Rendering the User's page to show all the users
router.get('/admin/users', isAdmin, async (req, res) => {
    const users = await User.find({});
    res.render('./admin/users', { users });
});

// Deleting a User
router.delete('/delete/:userId', isAdmin, wrapAsync(async (req, res) => {
    const { userId } = req.params;
    const user = await User.findByIdAndDelete(userId);
    req.flash('success', `"${user.username}" has been removed Successfully!`)
    res.redirect('/admin/users');
}));

// Rendering the Order's Page
router.get('/admin/orders', isAdmin, wrapAsync(async (req, res) => {
    const newOrders = await Order.find({ newOrder: true }).populate("products.product").populate('user');
    const oldOrders = await Order.find({ newOrder: false }).populate("products.product").populate('user');
    newOrders.formattedOrderDate
    oldOrders.formattedOrderDate
    // res.send(newOrders)
    // console.log(newOrders)
    // res.send(oldOrders)
    res.render('./admin/orders', { newOrders, oldOrders });
}));

// Marking the order to shipped
router.post('/shipped/:orderId', isAdmin, wrapAsync(async (req, res) => {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);
    order.newOrder = false;
    await order.save();
    req.flash('success', 'Order has been marked "Shipped"')
    res.redirect('/admin/orders');
}))

// Rendering Admin's Page
router.get('/admin/all', isAdmin, wrapAsync(async (req, res) => {
    const admins = await Admin.find({});
    const secret = secretKey;
    res.render('./admin/admins', { admins, secret });
}));

// Logging out an admin account
router.get('/admin/logout', isAdmin, wrapAsync(async (req, res) => {
    req.logout(() => {
        return res.redirect('/')
    });
}))

// Deleting an Admin account
router.delete('/admin/delete/:adminId', isAdmin, wrapAsync(async (req, res) => {
    const { adminId } = req.params;
    const admin = await Admin.findByIdAndDelete(adminId);
    req.flash('success', `${admin.username} has been deleted successfully.`);
    res.redirect('/admin/all');
}));


module.exports = router;