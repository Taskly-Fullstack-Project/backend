const {
  signup,
  verifyAccount,
  login,
  protect,
  resendVerificationToken,
} = require("../controllers/authController");
const { getAllProjects } = require("../controllers/projectsController");
const { myTasks } = require("../controllers/taskController");
const {
  me,
  updateMe,
  search,
  readNotifications,
} = require("../controllers/usersController");
const { uploadImage } = require("../utils/imageCloud");
const upload = require("../utils/multer");
const userRouter = require("express").Router();

userRouter.get("/search", protect, search);
userRouter.post("/signup", upload.single("photo"), uploadImage, signup);
userRouter.post("/verify", verifyAccount);
userRouter.post("/login", login);
userRouter.post("/resendVerification", resendVerificationToken);
userRouter
  .route("/me")
  .all(protect)
  .get(me)
  .patch(upload.single("photo"), uploadImage, updateMe);
userRouter.get("/myProjects", protect, getAllProjects);
userRouter.get("/myTasks", protect, myTasks);
userRouter.patch("/notifications", protect, readNotifications);

module.exports = userRouter;
