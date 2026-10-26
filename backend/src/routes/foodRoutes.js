const express=require("express");
const router=express.Router();
const food=require("../controllers/foodcontroller");
const authmidd=require("../middleware/authmiddleware");
const allowroles=require("../middleware/rolemiddleware");

router.post("/",authmidd,allowroles("cook"),food.create);
router.get("/all",food.getall);
router.get("/myfoods",authmidd,food.myfood);
router.get("/cook/:id",food.cooks);
router.get("/:id",food.id);
router.patch("/:id",authmidd,allowroles("cook"),food.patch);
router.patch("/:id/avaliablity",authmidd,allowroles("cook"),food.ava);
router.delete("/:id",authmidd,allowroles("cook"),food.deletee);
module.exports=router;