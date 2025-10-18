import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import { initializeDomains } from "./controllers/domainController.js";
import errorHandler from "./middleware/errorHandler.js";
import authRoutes from "./routes/auth.js";
import broadcastRoutes from "./routes/broadcast.routes.js";
import directMessageRoutes from "./routes/directMessageRoutes.js";
import domainRoutes from "./routes/domain.js";
import employerRoutes from "./routes/employer.routes.js";
import interviewRoutes from "./routes/interview.routes.js";
import jobRoutes from "./routes/jobRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import notificationRoutes from "./routes/notification.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import resumeRoutes from "./routes/resumeRoutes.js";
import userSearchRoutes from "./routes/userSearch.routes.js";

dotenv.config();

const app = express();

// Middleware
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
    ],
    credentials: true,
  })
);
app.use(express.json());

// Add security headers
app.use((req, res, next) => {
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

// MongoDB Connection with enhanced error handling
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Initialize domains after successful database connection
    await initializeDomains();

    // Handle connection errors after initial connection
    mongoose.connection.on("error", (err) => {
      console.error("MongoDB connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      console.log("MongoDB disconnected. Attempting to reconnect...");
      setTimeout(connectDB, 5000);
    });

    mongoose.connection.on("reconnected", () => {
      console.log("MongoDB reconnected");
    });
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1);
  }
};

// Connect to MongoDB
connectDB();

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "FindX Backend API is running!",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Add root route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "FindX API Server is running",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    endpoints: {
      jobs: "/api/jobs",
      auth: "/api/auth",
      employer: "/api/employer",
      notifications: "/api/notifications",
    },
  });
});

// Add API base route
app.get("/api", (req, res) => {
  res.json({
    success: true,
    message: "FindX API Base",
    version: "1.0.0",
    availableRoutes: [
      "GET /api/jobs - Get all jobs (paginated)",
      "GET /api/jobs/search - Search jobs with filters (paginated)",
      "POST /api/auth/signup - User signup",
      "POST /api/auth/login - User login",
      "POST /api/employer/createAccount - Employer signup",
      "POST /api/employer/login - Employer login",
      "GET /api/notifications - Get notifications (auth required)",
    ],
  });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/employer", employerRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/direct-messages", directMessageRoutes);
app.use("/api/user-search", userSearchRoutes);
app.use("/api/interviews", interviewRoutes);
app.use("/api/broadcast", broadcastRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/resume", resumeRoutes);
app.use("/api/domains", domainRoutes);
app.use("/api/notifications", notificationRoutes);

// Error handling middleware
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
