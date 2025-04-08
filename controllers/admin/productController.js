const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const Users = require("../../models/userSchema");

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const getProductAddPage = async (req, res) => {
  try {
    const category = await Category.find({ isListed: true });
    const brand = await Brand.find({ isBlocked: false });
    res.render("product-add", {
      cat: category,
      brand: brand
    });
  } catch (error) {
    res.redirect("/admin/pageerror");
  }
};

const addProducts = async (req, res) => {
  try {
    const products = req.body;
    const productExists = await Product.findOne({
      productName: products.productName,
    });

    if (!productExists) {
      // Get selected sizes (always as an array)
      let sizes = req.body.size;
      if (!sizes) {
        sizes = []; // if no sizes are selected
      } else if (!Array.isArray(sizes)) {
        sizes = [sizes];
      }
      sizes = sizes.map(Number);

      // Build the variants array by reading the stock value for each selected size.
      // Expect input names like "stock_8" for size 8, "stock_9" for size 9, etc.
      let variants = [];
      sizes.forEach(size => {
        const stockValue = req.body[`stock_${size}`];
        if (stockValue !== undefined && stockValue !== "") {
          variants.push({ size, stock: Number(stockValue) });
        }
      });

      const images = [];
      if (req.files && req.files.length > 0) {
        for (let i = 0; i < req.files.length; i++) {
          const originalImagePath = req.files[i].path;
          const resizedImagePath = path.join(
            'public',
            'uploads',
            'product-images',
            req.files[i].filename
          );
          await sharp(originalImagePath)
            .resize({ width: 440, height: 440 })
            .toFile(resizedImagePath);
          images.push(req.files[i].filename);
        }
      }

      const categoryId = await Category.findOne({ name: products.category });
      if (!categoryId) {
        return res.status(400).send("Invalid category name");
      }

      // Create a new product using the variants array
      const newProduct = new Product({
        productName: products.productName,
        description: products.description,
        brand: products.brand,
        category: categoryId._id,
        regularPrice: products.regularPrice,
        salePrice: products.salePrice,
        // You can remove or repurpose the old quantity field if no longer needed.
        color: products.color,
        // Save the variants array with each size and its stock
        variants: variants,
        productImage: images,
        status: 'Available',
      });

      await newProduct.save();
      return res.redirect("/admin/addProducts?success=true");
    } else {
      return res.status(400).json("Product already exists. Try with another name");
    }
  } catch (error) {
    console.error("Error saving product", error);
    return res.redirect("/admin/pageerror");
  }
};


const getAllProducts = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    
    const productData = await Product.find({
      $or: [
        { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
        { brand: { $regex: new RegExp(".*" + search + ".*", "i") } },
      ],
    })
      .sort({ createdAt: -1 })
      .collation({ locale: "en", strength: 2 })
      .limit(limit)
      .skip((page - 1) * limit)
      .populate('category')
      .exec();

    const count = await Product.find({
      $or: [
        { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
        { brand: { $regex: new RegExp(".*" + search + ".*", "i") } },
      ],
    }).countDocuments();

    const category = await Category.find({ isListed: true });
    const brand = await Brand.find({ isBlocked: false });

    if (category && brand) {
      res.render('products', {
        data: productData,
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        cat: category,
        brand: brand
      });
    } else {
      res.render('page-404');
    }
  } catch (error) {
    res.redirect("/admin/pageerror");
  }
};

const addProductOffer = async (req, res) => {
  try {
    const { productId, percentage } = req.body;
    const findProduct = await Product.findOne({ _id: productId });
    const findCategory = await Category.findOne({ _id: findProduct.category });

    if (findCategory.categoryOffer && findCategory.categoryOffer > 0) {
      findCategory.categoryOffer = 0;
      await findCategory.save();
    }

    if (percentage >= 100) {
      return res.status(400).json({ status: false, message: "Percentage must be less than 100." });
    }
    if (percentage < 0) {
      return res.status(400).json({ status: false, message: "Percentage cannot be negative." });
    }
    

    findProduct.salePrice = findProduct.regularPrice - Math.floor(findProduct.regularPrice * (percentage / 100));
    findProduct.productOffer = parseInt(percentage);
    await findProduct.save();
    findCategory.categoryOffer = 0;
    await findCategory.save();
    res.json({ status: true });
  } catch (error) {
    res.redirect("/admin/pageerror");
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

const removeProductOffer = async (req, res) => {
  try {
    const { productId } = req.body;
    const findProduct = await Product.findOne({ _id: productId });
    findProduct.salePrice = findProduct.regularPrice;
    findProduct.productOffer = 0;
    await findProduct.save();
    res.json({ status: true });
  } catch (error) {
    res.redirect("/admin/pageerror");
  }
};

const blockProduct = async (req, res) => {
  try {
    let id = req.query.id;
    await Product.updateOne({ _id: id }, { $set: { isBlocked: true } });
    res.redirect("/admin/products");
  } catch (error) {
    res.redirect("/admin/pageerror");
  }
};

const unblockProduct = async (req, res) => {
  try {
    let id = req.query.id;
    await Product.updateOne({ _id: id }, { $set: { isBlocked: false } });
    res.redirect("/admin/products");
  } catch (error) {
    res.redirect("/admin/pageerror");
  }
};

const getEditProduct = async (req, res) => {
  try {
    const id = req.query.id;
    // Populate the category so we can compare its _id later in the view
    const product = await Product.findOne({ _id: id }).populate('category');
    const category = await Category.find({});
    const brand = await Brand.find({});
    res.render("edit-product", {
      product: product,
      cat: category,
      brand: brand,
    });
  } catch (error) {
    res.redirect("/admin/pageerror");
  }
};

const editProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const product = await Product.findOne({ _id: id });
    const data = req.body;

    // 1. Check for duplicate product name
    const existingProduct = await Product.findOne({
      productName: data.productName,
      _id: { $ne: id }
    });
    if (existingProduct) {
      return res.status(400).json({ error: "Product with this name already exists. Please try with another name" });
    }

    // 2. Update text fields
    product.productName = data.productName;
    product.description = data.description;
    product.brand = data.brand;
    product.category = data.category;
    product.regularPrice = data.regularPrice;
    product.salePrice = data.salePrice;
    product.color = data.color;
    // Remove old quantity/size updates:
    // product.quantity = data.quantity;
    // product.size = data.size;

    // --- Process variants from sizes & stock inputs ---
    let sizes = req.body.size;
    if (!sizes) {
      sizes = []; // No sizes selected
    } else if (!Array.isArray(sizes)) {
      sizes = [sizes]; // Convert single value to array
    }
    sizes = sizes.map(Number);

    let variants = [];
    sizes.forEach(size => {
      const stockValue = req.body[`stock_${size}`];
      if (stockValue !== undefined && stockValue !== "") {
        variants.push({ size, stock: Number(stockValue) });
      }
    });
    product.variants = variants;
    // --- End variants processing ---

    // 3. Process image updates for each slot (1..4)
    for (let i = 1; i <= 4; i++) {
      const fieldName = 'image' + i;
      if (req.files && req.files[fieldName] && req.files[fieldName][0]) {
        const file = req.files[fieldName][0];
        const filename = file.filename;
        // Resize the image using sharp
        const originalImagePath = file.path;
        const resizedImagePath = path.join("public", "uploads", "product-images", filename);
        await sharp(originalImagePath)
          .resize({ width: 440, height: 440 })
          .toFile(resizedImagePath);

        // Remove the old image from disk if it exists
        if (product.productImage[i - 1]) {
          const oldFilename = product.productImage[i - 1];
          const oldImagePath = path.join("public", "uploads", "product-images", oldFilename);
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        }
        // Update the product image array
        product.productImage[i - 1] = filename;
      }
    }

    // 4. Save changes
    await product.save();
    res.redirect("/admin/products");
  } catch (error) {
    console.error(error);
    res.redirect("/admin/pageerror");
  }
};





const deleteSingleImage = async (req, res) => {
  try {
    const { imageNameToServer, productIdToServer } = req.body;
    await Product.findByIdAndUpdate(productIdToServer, {
      $pull: { productImage: imageNameToServer }
    });
    // Use the correct folder where images are stored
    const imagePath = path.join("public", "uploads", "product-images", imageNameToServer);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
      console.log(`Image ${imageNameToServer} deleted successfully`);
    } else {
      console.log(`Image ${imageNameToServer} not found`);
    }
    res.send({ status: true });
  } catch (error) {
    res.redirect("/admin/pageerror");
  }
};

module.exports = {
  getProductAddPage,
  addProducts,
  getAllProducts,
  addProductOffer,
  removeProductOffer,
  blockProduct,
  unblockProduct,
  getEditProduct,
  editProduct,
  deleteSingleImage
};
