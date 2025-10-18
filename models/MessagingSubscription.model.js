import mongoose from 'mongoose';

const messagingSubscriptionSchema = new mongoose.Schema({
    employerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employer',
        required: true,
        unique: true
    },
    subscriptionType: {
        type: String,
        enum: ['messaging_pack'],
        default: 'messaging_pack'
    },
    price: {
        type: Number,
        required: true,
        default: 4900 // $49.00 AUD in cents
    },
    currency: {
        type: String,
        default: 'aud'
    },
    totalContacts: {
        type: Number,
        required: true,
        default: 5 // Maximum 5 users can be contacted
    },
    remainingContacts: {
        type: Number,
        required: true,
        default: 5 // Remaining contacts available
    },
    contactedUsers: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        contactedAt: {
            type: Date,
            default: Date.now
        },
        firstMessageId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Message',
            required: false
        }
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    purchaseDate: {
        type: Date,
        default: Date.now
    },
    // No expiry date as per requirements - subscription doesn't expire
    paymentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payment',
        required: false
    },
    stripePaymentIntentId: {
        type: String,
        required: false
    }
}, {
    timestamps: true
});

// Index for efficient queries
messagingSubscriptionSchema.index({ employerId: 1 });
messagingSubscriptionSchema.index({ isActive: 1 });
messagingSubscriptionSchema.index({ 'contactedUsers.userId': 1 });

// Method to check if employer can contact a user
messagingSubscriptionSchema.methods.canContactUser = function(userId) {
    // Check if user has already been contacted
    const alreadyContacted = this.contactedUsers.some(
        contact => contact.userId.toString() === userId.toString()
    );
    
    if (alreadyContacted) {
        return { canContact: true, reason: 'already_contacted' };
    }
    
    // Check if there are remaining contacts
    if (this.remainingContacts <= 0) {
        return { canContact: false, reason: 'no_remaining_contacts' };
    }
    
    // Check if subscription is active
    if (!this.isActive) {
        return { canContact: false, reason: 'subscription_inactive' };
    }
    
    return { canContact: true, reason: 'new_contact_allowed' };
};

// Method to record a new contact
messagingSubscriptionSchema.methods.recordContact = function(userId, messageId = null) {
    // Check if user has already been contacted
    const alreadyContacted = this.contactedUsers.some(
        contact => contact.userId.toString() === userId.toString()
    );
    
    if (!alreadyContacted && this.remainingContacts > 0) {
        this.contactedUsers.push({
            userId: userId,
            contactedAt: new Date(),
            firstMessageId: messageId
        });
        this.remainingContacts -= 1;
        return true;
    }
    
    return false;
};

// Static method to get or create subscription for employer
messagingSubscriptionSchema.statics.getOrCreateForEmployer = async function(employerId) {
    let subscription = await this.findOne({ employerId });
    
    if (!subscription) {
        subscription = new this({
            employerId,
            subscriptionType: 'messaging_pack',
            price: 4900,
            totalContacts: 5,
            remainingContacts: 5,
            isActive: false // Will be activated after payment
        });
        await subscription.save();
    }
    
    return subscription;
};

const MessagingSubscription = mongoose.model('MessagingSubscription', messagingSubscriptionSchema);

export default MessagingSubscription;