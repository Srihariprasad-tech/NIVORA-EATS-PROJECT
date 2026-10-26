const express=require('express');
const app=express();

const cors=require("cors");

// CORS: which websites may call this API.
// On Render set CORS_ORIGINS to your frontend address, e.g.
//   CORS_ORIGINS=https://nivora-eats.netlify.app
// (several: separate with commas). If it is not set, every site is allowed (fine for local testing).
const allowedOrigins=(process.env.CORS_ORIGINS || "")
    .split(",")
    .map(o=>o.trim().replace(/\/$/,""))
    .filter(Boolean);

app.use(cors({
    origin: allowedOrigins.length ? allowedOrigins : "*",
    methods: ["GET","POST","PATCH","DELETE"],
    allowedHeaders: ["Content-Type","Authorization"]
}));

const errohandler=require("./middleware/errohandler");
const createroute=require("./routes/userRoutes");
const authroute=require("./routes/authRoutes");
const foodroute=require("./routes/foodRoutes.js");
const cartroute=require("./routes/cartRoutes.js");
const addressroute=require("./routes/addressRoutes.js");
const checkoutroute=require("./routes/checkoutRoutes.js");
const paymentorders=require("./routes/paymentsRoutes.js");
const orderroutes = require("./routes/orderRoutes.js");
const reviewroutes = require("./routes/reviewRoutes.js");
app.use(express.json());



app.use("/users",createroute);
app.use("/auth",authroute);
app.use("/food",foodroute);
app.use("/cook",foodroute);
app.use("/cart",cartroute);
app.use("/address",addressroute);
app.use("/checkout",checkoutroute);
app.use("/payment",paymentorders);
app.use("/orders", orderroutes);
app.use("/reviews", reviewroutes);
app.use((req,res)=>
{
    res.status(404).json({
        success:false,
        message:"route not found"
    });
});

app.use(errohandler);
module.exports=app;





