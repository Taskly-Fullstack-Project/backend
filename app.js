const express = require("express");
const userRouter = require("./routes/userRoutes");
const projectRouter = require("./routes/projectRoutes");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");

const app = express();

app.use(cors());

app.use(helmet());

const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  message: "Too many requests from that IP please try again in an hour",
});
app.use("/api", limiter);
app.use(express.json({ limit: "10kb" }));

app.use(async (req, res, next) => {
  console.log(req.headers);
  next();
});

// app.use((req,res,next)=>{
//   console.log(req.app);
//   next()
// })

app.use("/api/v1/users", userRouter);
app.use("/api/v1/projects", projectRouter);

app.use((err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";
  res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
    errors: err,
    stack: err.stack,
  });
});

module.exports = app;
