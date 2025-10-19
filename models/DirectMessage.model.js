import mongoose from "mongoose";

const directMessageSchema = new mongoose.Schema({
    senderId: {
        type: String,
        required: true
    },
    receiverId: {
        type: String,
        required: true
    },
    senderMessageContent: {
        type: [String],
        required: false
    },
    receiverMessageContent: {
        type: [String],
        required: false
    },
    dmConfig: {
        
    }
});

const DirectMessage = mongoose.model("DirectMessage", directMessageSchema);

export default DirectMessage;