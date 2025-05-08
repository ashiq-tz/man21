const Order = require ("../../models/orderSchema");
const mongoose = require ('mongoose');
const ExcelJS = require ('exceljs');
const PDFDocument = require ('pdfkit');

function parseRange(range, start, end){
    const now = new Date();
    let from, to;

    switch (range) {
        case 'daily':
            from = new Date(now.setHours(0,0,0,0));
            to = new Date(now.setHours(23,59,59,999));
            break;
        case 'weekly':
            from = new Date(now);
            from.setDate(from.getDate() - 6);
            from.setHours(0,0,0,0);
            to = new Date(now.setHours(23,59,59,999));
            break;
        case 'monthly':
            from = new Date(now.getFullYear(), now.getMonth(), 1);
            to = new Date(now.getFullYear(), now.getMonth()+1, 0, 23,59,59,999);
            break;
        case 'yearly':
            from = new Date(now.getFullYear(), 0, 1);
            to = new Date(now.getFullYear(), 11, 31, 23,59,59,999);
            break;
        case 'custom':
            from = new Date(start);
            to = new Date(end);
            break;    
        default:
            throw new Error('Invalid range'); 
    }
    return {from, to};
}

async function loadDashboard(req,res) {
    try{
    const {range, startDate, endDate, download, format} = req.query;

    
    if (!range) {
        return res.redirect('/admin/dashboard?range=weekly');
      }

    if (range === 'custom') {
        const today = new Date();
        
        if (!startDate || !endDate) {
          return res.status(400).send('Both startDate and endDate are required for a custom report.');
        }
        const from = new Date(startDate);
        const to   = new Date(endDate);
        if (from > to) {
          return res.status(400).send('Start date cannot be after end date.');
        }
        if (from > today ) {
          return res.status(400).send('Dates cannot be in the future.');
        }
    }
      
      
    const {from, to} = parseRange(range, startDate, endDate);
    const match = {
        status:{$nin: ['Cancelled', 'Returned', 'Return Requested']},
        createdAt: { $gte: from, $lte: to }
    };

    const summary = await Order.aggregate([
        { $match: match },
        { $group: {
            _id: null,
            totalOrders:    { $sum: 1 },
            totalAmount:    { $sum: '$finalAmount' },
            totalDiscount:  { $sum: '$productDiscount' }, 
            totalCoupons:   { $sum: '$couponAmount' }    
        }}
    ]);

    
    const breakdown = await Order.aggregate([
        { $match: match },
        { $group: {
            _id: {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' },
                day: { $dayOfMonth: '$createdAt' }
            },
            orders: { $sum: 1 },
            amount:   { $sum: '$finalAmount' },
            discount: { $sum: '$productDiscount' },
            coupons:  { $sum: '$couponAmount' }
        }},
        { $sort: { '_id.year':1, '_id.month':1, '_id.day':1 } }
    ]);

    const stats = summary[0] || { 
        totalOrders: 0,
        totalAmount: 0,
        totalDiscount: 0,
        totalCoupons:  0 
    };

    //fetch every order 
    const orders = await Order.find(match)
      .sort({ createdAt: -1 })
      .select('orderId createdAt finalAmount productDiscount couponAmount')
      .lean();


     // Top 3 Best Selling Products 
     const bestSellingProducts = await Order.aggregate([
        { $match: match },
        { $group: { _id: "$product", totalQuantity: { $sum: "$quantity" } } },
        { $sort: { totalQuantity: -1 } },
        { $limit: 3 },
      
        // bring in all product fields
        { $lookup: {
            from: "products",
            localField: "_id",
            foreignField: "_id",
            as: "productDetails"
        }},
        { $unwind: "$productDetails" },
      
        // bring in the category document
        { $lookup: {
            from: "categories",
            localField: "productDetails.category",
            foreignField: "_id",
            as: "categoryDetails"
        }},
        { $unwind: "$categoryDetails" },
      
        // project exactly what you need
        { $project: {
            _id:            1,
            totalQuantity:  1,
            productName:    "$productDetails.productName",
            productPrice:   "$productDetails.salePrice",
            productCategory:"$categoryDetails.name",
            // grab the first image from the array
            productImage:   { $arrayElemAt: ["$productDetails.productImage", 0] }
        }}
      ]);
      
  
      const bestSellingCategories = await Order.aggregate([
        { $match: match },
        { $lookup: {
            from: "products",
            localField: "product",
            foreignField: "_id",
            as: "productDetails"
        }},
        { $unwind: "$productDetails" },
        { $group: {
            _id: "$productDetails.category",
            totalQuantity: { $sum: "$quantity" }
        }},
        { $sort: { totalQuantity: -1 } },
        { $limit: 3 },
      
        // join in the category doc
        { $lookup: {
            from: "categories",
            localField: "_id",
            foreignField: "_id",
            as: "categoryDetails"
        }},
        { $unwind: "$categoryDetails" },
      
        // project a nice shape
        { $project: {
            _id: 0,
            categoryName:  "$categoryDetails.name",
            totalQuantity: 1
        }}
      ]) || [];

    // Top 3 Best-Selling Brands 
    const bestSellingBrands = await Order.aggregate([
        { $match: match },
        // bring in each order’s product
        { $lookup: {
            from: "products",
            localField: "product",
            foreignField: "_id",
            as: "productDetails"
        }},
        { $unwind: "$productDetails" },
        // group by productDetails.brand (a string)
        { $group: {
            _id: "$productDetails.brand",
            totalQuantity: { $sum: "$quantity" }
        }},
        { $sort: { totalQuantity: -1 } },
        { $limit: 3 },
        // lookup brand doc by brandName
        { $lookup: {
            from: "brands",
            localField: "_id",
            foreignField: "brandName",
            as: "brandDetails"
        }},
        { $unwind: "$brandDetails" },
        // project just the fields you need
        { $project: {
            _id: 0,
            brandName:    "$_id",
            totalQuantity: 1,
            // pick the first image filename
            brandImage:   { $arrayElemAt: ["$brandDetails.brandImage", 0] }
        }}
    ]) || [];
    
      
  
  // Include these fields in your data object:
  const data = {
    stats,
    orders,
    breakdown,
    range,
    from,
    to,
    bestSellingProducts,
    bestSellingCategories,
    bestSellingBrands
  };
  

   
    if (download === '1') {
      if (format === 'excel') return await downloadExcel(res, data);
      if (format === 'pdf')   return await downloadPdf(res, data);
      
  }

  res.render('dashboard',{ data, query: req.query })

} catch (error) {
    console.error(error);
    res.redirect("/admin/pageerror")
}
}

// Excel download via exceljs
async function downloadExcel(res, { stats, breakdown, range, from, to }) {
const wb = new ExcelJS.Workbook();
const ws = wb.addWorksheet('Sales Report');

// header
ws.addRow(['Sales Report']);
ws.addRow([`Range: ${range} (${from.toLocaleDateString()} – ${to.toLocaleDateString()})`]);
ws.addRow([]);
ws.addRow(['Total Orders', stats.totalOrders]);
ws.addRow(['Total Amount (₹)', stats.totalAmount]);
ws.addRow(['Total Discount (₹)', stats.totalDiscount]);
ws.addRow([]);
ws.addRow(['Date', 'Orders', 'Amount (₹)', 'Discount (₹)']);

breakdown.forEach(row => {
  const d = row._id;
  const label = `${d.day}-${d.month}-${d.year}`;
  ws.addRow([ label, row.orders, row.amount, row.discount ]);
});

res.setHeader(
  'Content-Disposition',
  `attachment; filename="sales-report-${Date.now()}.xlsx"`
);
res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
await wb.xlsx.write(res);
res.end();
}

// PDF download via pdfkit
async function downloadPdf(res, { stats, breakdown, range, from, to }) {
const doc = new PDFDocument({ margin: 40 });
res.setHeader('Content-disposition', `attachment; filename="sales-report-${Date.now()}.pdf"`);
res.setHeader('Content-type', 'application/pdf');
doc.pipe(res);

doc.fontSize(18).text('Sales Report', { align: 'center' });
doc.moveDown();
doc.fontSize(12).text(`Range: ${range} (${from.toLocaleDateString()} – ${to.toLocaleDateString()})`);
doc.moveDown();
doc.text(`Total Orders: ${stats.totalOrders}`);
doc.text(`Total Amount (₹): ${stats.totalAmount}`);
doc.text(`Total Discount (₹): ${stats.totalDiscount}`);
doc.moveDown();

// table header
doc.font('Helvetica-Bold')
   .text('Date', 50)
   .text('Orders', 150)
   .text('Amount', 250)
   .text('Discount', 350);
doc.moveDown(0.5).font('Helvetica');

breakdown.forEach(r => {
  const d = r._id;
  const label = `${d.day}-${d.month}-${d.year}`;
  doc.text(label, 50)
     .text(r.orders, 150)
     .text(r.amount, 250)
     .text(r.discount, 350);
  doc.moveDown(0.2);
});

doc.end();

}
        
    
        

        
  

module.exports = {
    loadDashboard
}

