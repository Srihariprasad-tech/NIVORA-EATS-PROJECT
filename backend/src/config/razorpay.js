// const Razorpay=require("razorpay");
// const razorpay=new Razorpay({
//     keyid:process.env.RAZORPAY_KEY_ID,
//     keysecret:process.env.RAZORPAY_SECRET
// });

// module.exports=razorpay;


const Razorpay = require("razorpay");
 
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_SECRET) {
    throw new Error(
        "Razorpay environment variables are missing. Check your .env file."
    );
}
 
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_SECRET
});
 
module.exports = razorpay;