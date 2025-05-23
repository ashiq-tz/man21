const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");



const categoryInfo = async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = 4;
      const skip = (page - 1) * limit;
  
      const query = {};
      if (req.query.search) {
        query.name = { $regex: new RegExp(req.query.search, 'i') };
      }
  
      // Get the filtered, paginated data
      const categoryData = await Category.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
  
      const totalCategories = await Category.countDocuments(query);
      const totalPages = Math.ceil(totalCategories / limit);
  
      // Check if the request is an AJAX call (live search)
      if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        return res.json({
          categories: categoryData,
          currentPage: page,
          totalPages: totalPages,
          totalCategories: totalCategories
        });
      }
  
      // For regular requests, render the EJS page
      res.render("category", {
        categories: categoryData,
        currentPage: page,
        totalPages: totalPages,
        totalCategories: totalCategories,
        search: req.query.search || ""
      });
    } catch (error) {
      console.error(error);
      res.redirect("/admin/pageerror");
    }
  };
  
  

const addCategory = async (req,res)=>{
    const {name,description} = req.body;
    try {

      const existingCategory = await Category.findOne({ 
        name: { $regex: new RegExp('^' + name + '$', 'i') }
      });
          
        if(existingCategory){
            return res.status(400).json({error:"Category already exist"})
        }
        const newCategory = new Category({
            name,
            description,
        })
        await newCategory.save();
        return res.json({message:"Category Added Successfully"})

    } catch (error) {
        return res.status(500).json({error:"Internal Server Error"})
    }
}

const addCategoryOffer = async (req,res)=>{

    try {
        
        const {categoryId, percentage} = req.body;

        if (percentage >= 100) {
            return res.status(400).json({ status: false, message: "Percentage must be less than 100." });
        }
        if (percentage <= 0) {
            return res.status(400).json({ status: false, message: "Percentage must be greater than 0" });
        }

        // const category =  await Category.findById(categoryId);
        // if(!category){
        //     return res.status(404).json({status:false , message:"Category not found"});
        // }
        // const products = await Product.find({category:category._id});
        // const hasProductOffer = products.some((product)=>product.productOffer > percentage);
        // if(hasProductOffer){
        //     return res.json({status:false , message:"Products within this category already have product-offer"})
        // }
        // await Category.updateOne({_id:categoryId},{$set:{categoryOffer:percentage}});
        await Category.findByIdAndUpdate(categoryId, { categoryOffer: percentage });
        return res.json({status:true});

    } catch (error) {
        res.status(500).json({status:false , message:"Internal Server Error"})
        
    }
}


const removeCategoryOffer = async (req,res)=>{

    try {
        
        const categoryId = req.body.categoryId;
        // const category = await Category.findById(categoryId);

        // if(!category){
        //     return res.status(404).json({status:"false" , message:"Category not found"})
        // }
        await Category.findByIdAndUpdate(categoryId, { categoryOffer:0 });
        return res.json({status:true});

    } catch (error) {
        res.status(500).json({status:false , message:"Internal Server Error"})
    }
}

const getListCategory = async (req,res)=>{
    try {
        let id = req.query.id;
        let page = req.query.page;
        await Category.updateOne({_id:id},{$set:{isListed:false}});
        await Product.updateMany({ category: id }, { $set: { isBlocked: true } });
        res.redirect("/admin/category?page="+page);

    } catch (error) {
        res.redirect("admin/pageerror")
    }
}

const getUnlistCategory = async (req,res)=>{
    try {
        let { id, page}  = req.query;
        await Category.updateOne({_id:id},{$set:{isListed:true}});
        await Product.updateMany({ category: id }, { $set: { isBlocked: false } });
        res.redirect("/admin/category?page="+page);

    } catch (error) {
        res.redirect("admin/pageerror")
    }
}

const getEditCategory = async (req,res)=>{
    try {
        
        const id = req.query.id;
        const category = await Category.findOne({_id:id});
        res.render("edit-category",{category:category});

    } catch (error) {
        res.redirect("/admin/pageerror")
    }
}

const editCategory = async (req,res)=>{
    try {
        
    const id = req.params.id;
    const {categoryName,description} = req.body;
    const existingCategory = await Category.findOne({name:categoryName})

    if(existingCategory){
        return res.status(400).json({error:"Category exists, choose another name"})
    }

    const updateCategory = await Category.findByIdAndUpdate(id,{
        name:categoryName,
        description:description,
    },{new:true});

    if(updateCategory){
        res.redirect("/admin/category");
    }else{
        res.status(404).json({error:"Category not found"})
    }

    } catch (error) {
        res.status(500).json({error:"Internal Server Error"})
    }
}


module.exports = {
    categoryInfo,
    addCategory,
    addCategoryOffer,
    removeCategoryOffer,
    getListCategory,
    getUnlistCategory,
    getEditCategory,
    editCategory

}