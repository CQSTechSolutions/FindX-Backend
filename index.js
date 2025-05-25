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
import {createServer} from "node:http";
import { startSocketServer } from './socket.js';

dotenv.config();

const app = express();
const server = createServer(app);

// Start Socket.IO server
const io = startSocketServer(server);

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

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT || 5000;

app.get("/", (req, res) => {
    res.status(200).send({message: "OK"})
});

// Listen on the HTTP server (not the Express app)
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
