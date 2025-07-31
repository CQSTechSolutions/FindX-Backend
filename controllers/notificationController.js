import Job from "../models/Job.model.js";
import Notification from "../models/Notification.model.js";
import Employer from "../models/employer.model.js";

// Create a notification for a user
export const createNotification = async (notificationData) => {
  try {
    const notification = await Notification.createNotification(
      notificationData
    );
    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
};

// Get user notifications with pagination
export const getUserNotifications = async (req, res, next) => {
  try {
    console.log("🔔 getUserNotifications called");
    console.log("User ID:", req.user?._id);
    console.log("Query params:", req.query);

    const { page = 1, limit = 20 } = req.query;
    const userId = req.user._id;

    if (!userId) {
      console.error("❌ No user ID found in request");
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    console.log("📋 Fetching notifications for user:", userId);
    const result = await Notification.getUserNotifications(
      userId,
      parseInt(page),
      parseInt(limit)
    );
    console.log("✅ Found notifications:", result.notifications.length);

    // Debug: Log first notification structure
    if (result.notifications.length > 0) {
      console.log(
        "🔍 Sample notification structure:",
        JSON.stringify(result.notifications[0], null, 2)
      );
    }

    res.json({
      success: true,
      data: result.notifications,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("❌ Error getting user notifications:", error);
    next(error);
  }
};

// Mark notifications as read
export const markNotificationsAsRead = async (req, res, next) => {
  try {
    const { notificationIds } = req.body;
    const userId = req.user._id;

    const result = await Notification.markAsRead(userId, notificationIds);

    res.json({
      success: true,
      message: "Notifications marked as read",
      updatedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error marking notifications as read:", error);
    next(error);
  }
};

// Get unread notification count
export const getUnreadCount = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const count = await Notification.getUnreadCount(userId);

    res.json({
      success: true,
      count,
    });
  } catch (error) {
    console.error("Error getting unread count:", error);
    next(error);
  }
};

// Delete a notification
export const deleteNotification = async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user._id;

    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      userId,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    res.json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting notification:", error);
    next(error);
  }
};

// Create job match notification
export const createJobMatchNotification = async (userId, jobId, matchScore) => {
  try {
    const job = await Job.findById(jobId).populate("postedBy", "companyName");
    if (!job) return null;

    const notificationData = {
      userId,
      type: "job_match",
      title: "New Job Match Found!",
      message: `A new job "${job.jobTitle}" at ${job.postedBy.companyName} matches your skills perfectly!`,
      priority: "high",
      actionUrl: `/job-details/${jobId}`,
      metadata: {
        jobId,
        employerId: job.postedBy._id,
      },
    };

    return await createNotification(notificationData);
  } catch (error) {
    console.error("Error creating job match notification:", error);
    return null;
  }
};

// Create application status notification
export const createApplicationStatusNotification = async (
  userId,
  jobId,
  status,
  employerId
) => {
  try {
    const job = await Job.findById(jobId).populate("postedBy", "companyName");
    const employer = await Employer.findById(employerId);
    if (!job || !employer) return null;

    let title, message;
    switch (status) {
      case "reviewed":
        title = "Application Reviewed";
        message = `Your application for "${job.jobTitle}" has been reviewed by ${employer.companyName}`;
        break;
      case "shortlisted":
        title = "Application Shortlisted!";
        message = `Congratulations! Your application for "${job.jobTitle}" has been shortlisted by ${employer.companyName}`;
        break;
      case "rejected":
        title = "Application Rejected";
        message = `Your application for "${job.jobTitle}" was not selected this time. Keep applying!`;
        break;
      default:
        title = "Application Status Update";
        message = `Your application for "${job.jobTitle}" status has been updated`;
    }

    const notificationData = {
      userId,
      type: "application_update",
      title,
      message,
      priority: status === "shortlisted" ? "high" : "medium",
      actionUrl: `/job-details/${jobId}`,
      metadata: {
        jobId,
        employerId,
      },
    };

    return await createNotification(notificationData);
  } catch (error) {
    console.error("Error creating application status notification:", error);
    return null;
  }
};

// Create interview invitation notification
export const createInterviewInvitationNotification = async (
  userId,
  jobId,
  interviewId,
  employerId
) => {
  try {
    const job = await Job.findById(jobId).populate("postedBy", "companyName");
    const employer = await Employer.findById(employerId);
    if (!job || !employer) return null;

    const notificationData = {
      userId,
      type: "interview_invitation",
      title: "Interview Invitation!",
      message: `You've been invited for an interview for "${job.jobTitle}" at ${employer.companyName}`,
      priority: "high",
      actionUrl: `/interview-invitations`,
      metadata: {
        jobId,
        employerId,
        interviewId,
      },
    };

    return await createNotification(notificationData);
  } catch (error) {
    console.error("Error creating interview invitation notification:", error);
    return null;
  }
};

// Create profile completion notification
export const createProfileCompletionNotification = async (
  userId,
  missingFields
) => {
  try {
    const notificationData = {
      userId,
      type: "profile_completion",
      title: "Complete Your Profile",
      message: `Add ${missingFields.join(
        ", "
      )} to get better job recommendations`,
      priority: "medium",
      actionUrl: "/profile-settings",
    };

    return await createNotification(notificationData);
  } catch (error) {
    console.error("Error creating profile completion notification:", error);
    return null;
  }
};

// Create promotion notification
export const createPromotionNotification = async (
  userId,
  jobId,
  promotionType,
  employerId
) => {
  try {
    const job = await Job.findById(jobId).populate("postedBy", "companyName");
    const employer = await Employer.findById(employerId);
    if (!job || !employer) return null;

    let title, message;
    switch (promotionType) {
      case "premium_listing":
        title = "🌟 Premium Job Match Found!";
        message = `${job.jobTitle} at ${employer.companyName} is now a premium listing and matches your skills perfectly!`;
        break;
      case "featured_job":
        title = "🔥 Featured Job Opportunity!";
        message = `${job.jobTitle} at ${employer.companyName} is now featured and looking for candidates like you!`;
        break;
      case "urgent_hiring":
        title = "⚡ Urgent Hiring Alert!";
        message = `${job.jobTitle} at ${employer.companyName} is urgently hiring and you're a great match!`;
        break;
      default:
        title = "💼 New Job Promotion!";
        message = `${job.jobTitle} at ${employer.companyName} has been promoted and matches your profile!`;
    }

    const notificationData = {
      userId,
      type: "promotion",
      title,
      message,
      priority: "high",
      actionUrl: `/job-details/${jobId}`,
      metadata: {
        jobId,
        employerId,
      },
    };

    return await createNotification(notificationData);
  } catch (error) {
    console.error("Error creating promotion notification:", error);
    return null;
  }
};

// Bulk create notifications for multiple users
export const createBulkNotifications = async (userIds, notificationData) => {
  try {
    const notifications = [];

    for (const userId of userIds) {
      const notification = await createNotification({
        ...notificationData,
        userId,
      });

      if (notification) {
        notifications.push(notification);
      }
    }

    return notifications;
  } catch (error) {
    console.error("Error creating bulk notifications:", error);
    throw error;
  }
};

// Cleanup expired notifications (can be called by a cron job)
export const cleanupExpiredNotifications = async (req, res, next) => {
  try {
    const result = await Notification.cleanupExpired();

    res.json({
      success: true,
      message: `Cleaned up ${result.deletedCount} expired notifications`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Error cleaning up expired notifications:", error);
    next(error);
  }
};
