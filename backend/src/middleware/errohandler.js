//  const errohandler=(err,req,res,next)=>
//  {
//     console.log("error middleware recived",err.message);
//     res.status(500).json({
//         success:false,
//         message:err.message
//     });
//  }
//  module.exports=errohandler;





const errohandler=(err,req,res,next)=>
{
    console.log("error middleware recived",err.message);

    let status=err.statusCode || 500;
    let message=err.message;

    if(err.code===11000)
    {
        status=409;
        const field=Object.keys(err.keyValue || {})[0] || "value";
        message=`${field} already exists`;
    }
    else if(err.name==="CastError")
    {
        status=400;
        message=`Invalid ${err.path}`;
    }
    else if(err.name==="ValidationError")
    {
        status=400;
        message=Object.values(err.errors).map(e=>e.message).join(", ");
    }
    else if(err.type==="entity.parse.failed")
    {
        status=400;
        message="Invalid JSON body";
    }

    res.status(status).json({
        success:false,
        message
    });
}
module.exports=errohandler;