import { Server } from "socket.io";
import mongoose from 'mongoose';

// Create Message model (moved from messageController.js)
const messageSchema = new mongoose.Schema({
    from: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'fromModel'
    },
    to: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'toModel'
    },
    fromModel: {
        type: String,
        required: true,
        enum: ['User', 'Employer']
    },
    toModel: {
        type: String,
        required: true,
        enum: ['User', 'Employer']
    },
    content: {
        type: String,
        required: true
    },
    jobId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Job'
    },
    read: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

export const Message = mongoose.model('Message', messageSchema);

export const startSocketServer = (server) => {
    const io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    // Store online users
    const onlineUsers = new Map();

    io.on("connection", (socket) => {
        console.log("A user connected:", socket.id);

        // Handle user joining
        socket.on("join", ({ userId, userType }) => {
            onlineUsers.set(socket.id, { userId, userType });
            
            // Join a room based on userId for private messaging
            socket.join(userId);
            
            console.log(`${userType} ${userId} joined`);
            
            // Notify others that user is online
            socket.broadcast.emit("userStatus", { userId, status: "online" });
        });

        // Handle sending messages
        socket.on("sendMessage", async (messageData) => {
            try {
                const { from, to, content, fromModel, toModel, jobId } = messageData;
                
                // Save message to database
                const newMessage = new Message({
                    from,
                    to,
                    content,
                    fromModel,
                    toModel,
                    jobId: jobId || null,
                });
                
                const savedMessage = await newMessage.save();
                
                // Emit the message to the recipient
                io.to(to).emit("receiveMessage", savedMessage);
                
                // Confirm to sender that message was sent
                socket.emit("messageSent", savedMessage);
                
                console.log(`Message sent from ${fromModel} ${from} to ${toModel} ${to}`);
            } catch (error) {
                console.error("Error sending message:", error);
                socket.emit("messageError", { error: "Failed to send message" });
            }
        });

        // Handle getting conversation history
        socket.on("getConversation", async ({ userId1, userId2 }) => {
            try {
                // Find all messages between the two users
                const messages = await Message.find({
                    $or: [
                        { from: userId1, to: userId2 },
                        { from: userId2, to: userId1 }
                    ]
                }).sort({ createdAt: 1 });
                
                socket.emit("conversationHistory", messages);
            } catch (error) {
                console.error("Error fetching conversation:", error);
                socket.emit("conversationError", { error: "Failed to fetch conversation" });
            }
        });

        // Handle user conversations list
        socket.on("getUserConversations", async ({ userId, userType }) => {
            try {
                // Find all conversations involving the user
                const messages = await Message.find({
                    $or: [
                        { from: userId, fromModel: userType },
                        { to: userId, toModel: userType }
                    ]
                }).sort({ createdAt: -1 });
                
                // Get unique conversation partners
                const conversations = [];
                const conversationPartners = new Set();
                
                messages.forEach(message => {
                    let partnerId;
                    let partnerType;
                    
                    if (message.from.toString() === userId) {
                        partnerId = message.to;
                        partnerType = message.toModel;
                    } else {
                        partnerId = message.from;
                        partnerType = message.fromModel;
                    }
                    
                    const partnerKey = `${partnerId}-${partnerType}`;
                    
                    if (!conversationPartners.has(partnerKey)) {
                        conversationPartners.add(partnerKey);
                        conversations.push({
                            partnerId,
                            partnerType,
                            lastMessage: message,
                            jobId: message.jobId
                        });
                    }
                });
                
                socket.emit("userConversations", conversations);
            } catch (error) {
                console.error("Error fetching conversations:", error);
                socket.emit("conversationsError", { error: "Failed to fetch conversations" });
            }
        });

        // Handle read messages
        socket.on("markAsRead", async ({ messageId }) => {
            try {
                await Message.findByIdAndUpdate(messageId, { read: true });
                socket.emit("messageMarkedAsRead", { messageId });
            } catch (error) {
                console.error("Error marking message as read:", error);
            }
        });

        // Handle disconnection
        socket.on("disconnect", () => {
            const user = onlineUsers.get(socket.id);
            if (user) {
                // Notify others that user is offline
                socket.broadcast.emit("userStatus", { 
                    userId: user.userId, 
                    status: "offline" 
                });
                
                onlineUsers.delete(socket.id);
                console.log(`User disconnected: ${user.userType} ${user.userId}`);
            } else {
                console.log("Unknown user disconnected");
            }
        });
    });

    return io;
};