import MessagingSubscription from '../models/MessagingSubscription.model.js';
import Message from '../models/Message.model.js';

/**
 * Middleware to check if employer has valid messaging subscription
 * and can contact the specified user
 */
export const checkMessagingSubscription = async (req, res, next) => {
  try {
    const { from, to, fromModel, toModel } = req.body;

    // Only check for employer to user messages
    if (fromModel !== 'Employer' || toModel !== 'User') {
      return next();
    }

    // Get employer's active subscription
    const subscription = await MessagingSubscription.findOne({
      employerId: from,
      isActive: true
    });

    if (!subscription) {
      return res.status(403).json({
        success: false,
        message: "You need an active messaging subscription to contact users. Please purchase a messaging pack.",
        requiresSubscription: true,
        subscriptionStatus: 'none'
      });
    }

    // Check if employer can contact this user
    const canContact = await subscription.canContactUser(to);
    if (!canContact) {
      return res.status(403).json({
        success: false,
        message: "You have reached your contact limit. Please purchase additional messaging credits.",
        requiresSubscription: true,
        subscriptionStatus: 'limit_reached',
        remainingContacts: subscription.remainingContacts,
        totalContacts: subscription.totalContacts
      });
    }

    // Add subscription info to request for use in controller
    req.messagingSubscription = subscription;
    next();

  } catch (error) {
    console.error('Error checking messaging subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating messaging subscription'
    });
  }
};

/**
 * Middleware to get messaging subscription status for employer
 */
export const getSubscriptionStatus = async (req, res, next) => {
  try {
    const employerId = req.params.employerId || req.body.employerId || req.user?.id;

    if (!employerId) {
      return res.status(400).json({
        success: false,
        message: 'Employer ID is required'
      });
    }

    const subscription = await MessagingSubscription.findOne({
      employerId,
      isActive: true
    }).populate('contactedUsers.userId', 'name email');

    req.subscriptionStatus = {
      hasSubscription: !!subscription,
      subscription: subscription || null,
      remainingContacts: subscription?.remainingContacts || 0,
      totalContacts: subscription?.totalContacts || 0,
      contactedUsers: subscription?.contactedUsers || []
    };

    next();

  } catch (error) {
    console.error('Error getting subscription status:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting subscription status'
    });
  }
};

/**
 * Middleware to check if employer can initiate contact with a specific user
 * Used for contact validation before showing contact options
 */
export const canContactUser = async (req, res, next) => {
  try {
    const { employerId, userId } = req.params;

    if (!employerId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Employer ID and User ID are required'
      });
    }

    // Check for existing conversation
    const existingConversation = await Message.findOne({
      $or: [
        { from: employerId, to: userId, fromModel: 'Employer', toModel: 'User' },
        { from: userId, to: employerId, fromModel: 'User', toModel: 'Employer' }
      ]
    });

    if (existingConversation) {
      // Existing conversation - no subscription check needed
      req.contactStatus = {
        canContact: true,
        reason: 'existing_conversation',
        requiresSubscription: false
      };
      return next();
    }

    // Check subscription for new contact
    const subscription = await MessagingSubscription.findOne({
      employerId,
      isActive: true
    });

    if (!subscription) {
      req.contactStatus = {
        canContact: false,
        reason: 'no_subscription',
        requiresSubscription: true,
        message: 'You need an active messaging subscription to contact users.'
      };
      return next();
    }

    const canContact = await subscription.canContactUser(userId);
    req.contactStatus = {
      canContact,
      reason: canContact ? 'subscription_valid' : 'contact_limit_reached',
      requiresSubscription: !canContact,
      remainingContacts: subscription.remainingContacts,
      totalContacts: subscription.totalContacts,
      message: canContact 
        ? 'You can contact this user.' 
        : 'You have reached your contact limit. Please purchase additional messaging credits.'
    };

    next();

  } catch (error) {
    console.error('Error checking contact permission:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking contact permission'
    });
  }
};