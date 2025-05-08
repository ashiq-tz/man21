const multer = require ("multer")
const path = require("path")

const storage = multer.diskStorage({
    destination:(req,file,cb)=>{
        cb(null,path.join(__dirname,"../public/uploads/re-image"))
    },
    filename:(req,file,cb)=>{
        cb(null,Date.now()+"-"+file.originalname);
    }
})

//only allow JPEG & PNG by checking the MIME type (and extension if you like)
const imageFileFilter = (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG and PNG images are allowed.'), false);
    }
  };

  module.exports = multer({
    storage,
    fileFilter: imageFileFilter,
  });