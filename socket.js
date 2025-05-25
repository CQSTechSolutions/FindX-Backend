import { Server } from "socket.io";
import Message from './models/Message.model.js';
import Job from './models/Job.model.js';

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

        // Handle sending messages with validation
        socket.on("sendMessage", async (messageData) => {
            try {
                const { from, to, content, fromModel, toModel, jobId } = messageData;
                
                // Validate required fields
                if (!from || !to || !content || !fromModel || !toModel || !jobId) {
                    socket.emit("messageError", { error: "All fields are required" });
                    return;
                }
                
                // Validate job exists
                const job = await Job.findById(jobId);
                if (!job) {
                    socket.emit("messageError", { error: "Job not found" });
                    return;
                }
                
                // Validate messaging permissions
                if (fromModel === 'User') {
                    // Check if user has applied for this job
                    const hasApplied = job.applicants.some(
                        applicant => applicant.user.toString() === from
                    );
                    
                    if (!hasApplied) {
                        socket.emit("messageError", { 
                            error: "You can only message employers for jobs you have applied to" 
                        });
                        return;
                    }
                    
                    // Validate the recipient is the job poster
                    if (job.postedBy.toString() !== to) {
                        socket.emit("messageError", { 
                            error: "You can only message the employer who posted this job" 
                        });
                        return;
                    }
                } else if (fromModel === 'Employer') {
                    // Check if employer owns this job
                    if (job.postedBy.toString() !== from) {
                        socket.emit("messageError", { 
                            error: "You can only send messages for jobs you have posted" 
                        });
                        return;
                    }
                    
                    // Validate the recipient has applied for this job
                    const hasApplied = job.applicants.some(
                        applicant => applicant.user.toString() === to
                    );
                    
                    if (!hasApplied) {
                        socket.emit("messageError", { 
                            error: "You can only message users who have applied for your jobs" 
                        });
                        return;
                    }
                }
                
                // Save message to database
                const newMessage = new Message({
                    from,
                    to,
                    content,
                    fromModel,
                    toModel,
                    jobId,
                });
                
                const savedMessage = await newMessage.save();
                
                // Populate the saved message
                const populatedMessage = await Message.findById(savedMessage._id)
                    .populate({
                        path: 'from',
                        refPath: 'fromModel',
                        select: 'name email companyName'
                    })
                    .populate({
                        path: 'to',
                        refPath: 'toModel',
                        select: 'name email companyName'
                    })
                    .populate('jobId', 'jobTitle');
                
                // Emit the message to the recipient
                io.to(to).emit("receiveMessage", populatedMessage);
                
                // Confirm to sender that message was sent
                socket.emit("messageSent", populatedMessage);
                
                console.log(`Message sent from ${fromModel} ${from} to ${toModel} ${to} for job ${jobId}`);
            } catch (error) {
                console.error("Error sending message:", error);
                socket.emit("messageError", { error: "Failed to send message" });
            }
        });

        // Handle getting conversation history with validation
        socket.on("getConversation", async ({ userId1, userId2, jobId }) => {
            try {
                if (!jobId) {
                    socket.emit("conversationError", { error: "Job ID is required" });
                    return;
                }
                
                // Validate job exists
                const job = await Job.findById(jobId);
                if (!job) {
                    socket.emit("conversationError", { error: "Job not found" });
                    return;
                }
                
                // Find all messages between the two users for this specific job
                const messages = await Message.find({
                    jobId: jobId,
                    $or: [
                        { from: userId1, to: userId2 },
                        { from: userId2, to: userId1 }
                    ]
                })
                .populate({
                    path: 'from',
                    refPath: 'fromModel',
                    select: 'name email companyName'
                })
                .populate({
                    path: 'to',
                    refPath: 'toModel',
                    select: 'name email companyName'
                })
                .populate('jobId', 'jobTitle')
                .sort({ createdAt: 1 });
                
                socket.emit("conversationHistory", {
                    messages,
                    job: {
                        _id: job._id,
                        jobTitle: job.jobTitle
                    }
                });
            } catch (error) {
                console.error("Error fetching conversation:", error);
                socket.emit("conversationError", { error: "Failed to fetch conversation" });
            }
        });

        // Handle user conversations list with proper validation
        socket.on("getUserConversations", async ({ userId, userType }) => {
            try {
                // Find all conversations involving the user
                const messages = await Message.find({
                    $or: [
                        { from: userId, fromModel: userType },
                        { to: userId, toModel: userType }
                    ]
                })
                .populate('jobId', 'jobTitle companyLogo')
                .populate({
                    path: 'from',
                    refPath: 'fromModel',
                    select: 'name email companyName companyLogo'
                })
                .populate({
                    path: 'to',
                    refPath: 'toModel',
                    select: 'name email companyName companyLogo'
                })
                .sort({ createdAt: -1 });
                
                // Group by conversation partners and jobs
                const conversationMap = new Map();
                
                messages.forEach(message => {
                    let partnerId, partnerType, partnerInfo;
                    
                    if (message.from._id.toString() === userId) {
                        partnerId = message.to._id;
                        partnerType = message.toModel;
                        partnerInfo = message.to;
                    } else {
                        partnerId = message.from._id;
                        partnerType = message.fromModel;
                        partnerInfo = message.from;
                    }
                    
                    const conversationKey = `${partnerId}-${message.jobId._id}`;
                    
                    if (!conversationMap.has(conversationKey)) {
                        conversationMap.set(conversationKey, {
                            partnerId: partnerId.toString(),
                            partnerType,
                            partnerInfo: {
                                name: partnerInfo.name || partnerInfo.companyName,
                                email: partnerInfo.email,
                                avatar: partnerInfo.companyLogo || null
                            },
                            jobId: message.jobId._id,
                            jobTitle: message.jobId.jobTitle,
                            lastMessage: {
                                content: message.content,
                                createdAt: message.createdAt,
                                fromModel: message.fromModel,
                                read: message.read
                            },
                            unreadCount: 0
                        });
                    }
                    
                    // Count unread messages
                    if (!message.read && message.to._id.toString() === userId) {
                        const conversation = conversationMap.get(conversationKey);
                        conversation.unreadCount++;
                    }
                });
                
                const conversations = Array.from(conversationMap.values());
                socket.emit("userConversations", conversations);
            } catch (error) {
                console.error("Error fetching conversations:", error);
                socket.emit("conversationsError", { error: "Failed to fetch conversations" });
            }
        });

        // Handle read messages
        socket.on("markAsRead", async ({ messageId, userId, partnerId, jobId }) => {
            try {
                if (messageId) {
                    // Mark single message as read
                    await Message.findByIdAndUpdate(messageId, { read: true });
                    socket.emit("messageMarkedAsRead", { messageId });
                } else if (userId && partnerId && jobId) {
                    // Mark all messages from partnerId to userId for this job as read
                    const result = await Message.updateMany(
                        {
                            from: partnerId,
                            to: userId,
                            jobId: jobId,
                            read: false
                        },
                        { read: true }
                    );
                    socket.emit("messagesMarkedAsRead", { 
                        modifiedCount: result.modifiedCount,
                        partnerId,
                        jobId 
                    });
                }
            } catch (error) {
                console.error("Error marking message as read:", error);
                socket.emit("markReadError", { error: "Failed to mark messages as read" });
            }
        });

        // Get applied jobs for messaging (User only)
        socket.on("getAppliedJobs", async ({ userId }) => {
            try {
                // Find all jobs where user has applied
                const jobs = await Job.find({
                    'applicants.user': userId
                })
                .populate('postedBy', 'companyName email companyLogo')
                .select('jobTitle postedBy applicants');
                
                // Filter to only include jobs where user has applied
                const appliedJobs = jobs.map(job => {
                    const userApplication = job.applicants.find(
                        applicant => applicant.user.toString() === userId
                    );
                    
                    return {
                        _id: job._id,
                        jobTitle: job.jobTitle,
                        employer: job.postedBy,
                        applicationStatus: userApplication?.status,
                        appliedOn: userApplication?.appliedOn
                    };
                });
                
                socket.emit("appliedJobs", appliedJobs);
            } catch (error) {
                console.error("Error fetching applied jobs:", error);
                socket.emit("appliedJobsError", { error: "Failed to fetch applied jobs" });
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