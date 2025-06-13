import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import authRoutes from './routes/auth.js';
import jobRoutes from './routes/jobRoutes.js';
import educationRoutes from './routes/education.js';
import employerRoutes from './routes/employer.routes.js';
import userSearchRoutes from './routes/userSearch.routes.js';
import messageRoutes from './routes/messageRoutes.js';
import errorHandler from './middleware/errorHandler.js';
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use(`/api/auth`, authRoutes);
app.use(`/api/jobs`, jobRoutes);
app.use(`/api/education`, educationRoutes);
app.use(`/api/employer`, employerRoutes);
app.use(`/api/usersearch`, userSearchRoutes);
app.use(`/api/messages`, messageRoutes);
// Error handling middleware
app.use(errorHandler);

// MongoDB connection options
const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

// Function to connect to MongoDB with retry logic
const connectWithRetry = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, mongooseOptions);
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    console.log('Retrying connection in 5 seconds...');
    setTimeout(connectWithRetry, 5000);
  }
};

// Initial connection
connectWithRetry();

// Handle MongoDB connection events
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected. Attempting to reconnect...');
  connectWithRetry();
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected');
});

const PORT = process.env.PORT || 5000;

app.get("/", (req, res) => {
    res.status(200).send({message: "OK"})
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
