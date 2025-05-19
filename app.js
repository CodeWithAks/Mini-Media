const express = require("express");
const app = express();
const userModel = require("./models/user");
const postModel = require("./models/post");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const user = require("./models/user");
const crypto = require("crypto");
const path = require("path");
const upload = require("./config/multer");


app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname,"public")));
app.use(cookieParser());

app.get("/", (req, res) => {
    res.render("index");
});


//Protected route
app.get("/profile", isLoggedIn, async(req, res) => {
    let user = await userModel.findOne({email:req.user.email}).populate("posts"); //turns IDs into actual documents
    res.render("profile",{user});
});

//image uploading route
app.get("/profile/upload",(req,res) => {
    res.render("profileupload");
});

app.post("/upload",isLoggedIn,upload.single("image"),async(req,res) => {
    let user = await userModel.findOne({email:req.user.email});  //whose pfp is uploaded
    user.profilepic = req.file.filename;
    await user.save();
    res.redirect("/profile");
});


//new post route(after loggin in)
app.post("/post",isLoggedIn,async(req,res) => {
    let user = await userModel.findOne({email:req.user.email}) //to see who logged in 
    let {content} = req.body;
    let post = await postModel.create({
        user: user._id,
        content
    });

    user.posts.push(post._id);  
    await user.save();
    res.redirect("/profile");
});

//Like route
app.get("/like/:id",isLoggedIn,async(req,res) => {
    let post = await postModel.findOne({_id:req.params.id}).populate("user"); 

    if(post.likes.indexOf(req.user.userid) === -1) { 
        post.likes.push(req.user.userid)  
        post.likes.splice(post.likes.indexOf(req.user.userid),1);
    }
    await post.save();
    res.redirect("/profile");
});

//Edit route
app.get("/edit/:id",async(req,res) => {
    let post = await postModel.findOne({_id:req.params.id}).populate("user");
    res.render("edit",{post});
});

//Update route
app.post("/update/:id",isLoggedIn,async(req,res) => {
    let post = await postModel.findOneAndUpdate({_id:req.params.id} , {content:req.body.content}).populate("user");
    res.redirect("/profile");
});

//Delete route
app.get("/delete/:id",async(req,res) => {
    let post = await postModel.deleteOne({_id:req.params.id});
    res.redirect("/profile");
});

//creating user 
app.post("/register", async (req, res) => {
    let { username, name, age, email, password } = req.body;
    let user = await userModel.findOne({ email });
    if (user) {
        return res.status(500).send("User already registered");
    }

    bcrypt.genSalt(10, (err, salt) => {
        bcrypt.hash(password, salt, async (err, hash) => {
            let user = await userModel.create({
                username,
                email,
                age,
                name,
                password: hash
            });

            let token = jwt.sign({ email: email, userid: user._id }, "shhh");
            res.cookie("token", token);
            res.send("Registered");
        })
    });
})

//Login route
app.get("/login", (req, res) => {
    res.render("login");
});

app.post("/login", async (req, res) => {
    let { email, password } = req.body;
    let user = await userModel.findOne({ email });
    if (!user) return res.status(500).send("Something went wrong");

    bcrypt.compare(password, user.password, (err, result) => {   
        if (result) {
            let token = jwt.sign({ email: email, userid: user._id }, "shhh");
            res.cookie("token", token);
            res.status(200).redirect("/profile");  
        }
        else res.redirect("/login");  
    });
})

//Logout route
app.get("/logout", (req, res) => {
    res.cookie("token", "");
    res.redirect("/login");
});

//It checks if the user is logged in by looking for a token in their cookies. If the token is valid, it allows the request to continue and attaches user info to req.user. It is a protective route
function isLoggedIn(req, res, next) {
    if (req.cookies.token === "") res.redirect("/login");
    else {
        let data = jwt.verify(req.cookies.token, "shhh");
        req.user = data;
        next();
    }
}







app.listen(8080, () => {
    console.log("Server running");
});