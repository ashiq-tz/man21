
const User = require('../../models/userSchema');

const updateWallet = async (userId, amount, description, orderId = null, type = "credit") => {
  try {
    return await User.findByIdAndUpdate(
      userId,
      {
        $inc: { wallet: amount },
        $push: {
          walletHistory: {
            date: new Date(),
            orderId: orderId, 
            status: description,
            type: type, // "credit" or "debit"
            amount: amount
          }
        }
      },
      { new: true }
    );
  } catch (error) {
    console.error("Error updating wallet:", error);
    throw error;
  }
};

module.exports = {
  updateWallet
};
