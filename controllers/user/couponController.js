// controllers/user/couponController.js
const Coupon = require("../../models/couponSchema");

const validateCoupon = async (req, res) => {
  try {
    const { code, cartTotal } = req.body;
    const userId = req.session.user;

 
    const coupon = await Coupon.findOne({ 
      name: code.toUpperCase(), 
      isDeleted: false 
    });
    if (!coupon) {
      return res.status(404).json({ valid: false, message: "Invalid coupon code." });
    }

    const now = new Date();
    if (now < coupon.createdOn || now > coupon.expireOn) {
      return res.status(400).json({ valid: false, message: "Coupon is expired or not yet active." });
    }

    if (cartTotal < coupon.minimumPrice) {
      return res.status(400).json({ valid: false,message: `Coupon requires a minimum purchase of ₹${coupon.minimumPrice}.` 
      });
    }

    if (coupon.usedBy.includes(userId)) {
      return res.status(400).json({ valid: false, message: "You have already used this coupon." });
    }

    req.session.coupon = {
      code: coupon.name,
      discount: coupon.offerPrice,
      minCart: coupon.minimumPrice
    };

    return res.json({
      valid: true,
      offerPrice: coupon.offerPrice,
      newTotal: cartTotal - coupon.offerPrice
    });

  } catch (err) {
    console.error("Coupon validation error:", err);
    return res.status(500).json({ valid: false, message: "Server error validating coupon." });
  }

};

const removeCoupon = (req, res) => {
  delete req.session.coupon;
  res.json({ success: true });
};

module.exports = {
    validateCoupon,
    removeCoupon
}
