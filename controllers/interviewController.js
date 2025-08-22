import InterviewInvitation from '../models/InterviewInvitation.model.js';
import Job from '../models/Job.model.js';
import Message from '../models/Message.model.js';
import User from "../models/User.js";
import Employer from "../models/employer.model.js";
import { createTransporter } from "./broadcastController.js";
import { createNotification } from "./notificationController.js";

/**
 * @desc    Send interview invitation to applicant
 * @route   POST /api/interviews/send-invitation
 * @access  Private (Employer only)
 */
export const sendInterviewInvitation = async (req, res, next) => {
  try {
    const { jobId, applicantId, applicationId, interviewDetails } = req.body;

    // Validate required fields
    if (!jobId || !applicantId || !applicationId || !interviewDetails) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // Verify job exists and employer owns it
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    if (job.postedBy.toString() !== req.employer._id.toString()) {
      return res.status(403).json({
        success: false,
        message:
          "You are not authorized to send interview invitations for this job",
      });
    }

    // Verify application exists
    const application = job.applicants.id(applicationId);
    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    if (application.user.toString() !== applicantId) {
      return res.status(400).json({
        success: false,
        message: "Application does not match the specified applicant",
      });
    }

    // Check if interview invitation already exists
    const existingInvitation = await InterviewInvitation.findOne({
      jobId,
      applicantId,
      status: { $in: ["pending", "accepted", "reschedule_requested"] },
    });

    if (existingInvitation) {
      return res.status(400).json({
        success: false,
        message:
          "An active interview invitation already exists for this applicant",
      });
    }

    // Create interview invitation
    const invitation = new InterviewInvitation({
      jobId,
      employerId: req.employer._id,
      applicantId,
      applicationId,
      interviewDetails: {
        date: new Date(interviewDetails.date),
        time: interviewDetails.time,
        duration: interviewDetails.duration || 60,
        location: interviewDetails.location,
        interviewType: interviewDetails.interviewType || "video-call",
        meetingLink: interviewDetails.meetingLink,
        contactNumber: interviewDetails.contactNumber,
        notes: interviewDetails.notes,
        requirements: interviewDetails.requirements || [],
      },
    });

    await invitation.save();

    // Update application status to 'Interview'
    application.status = "Interview";
    application.interviewDetails = {
      date: interviewDetails.date,
      time: interviewDetails.time,
      location: interviewDetails.location,
      notes: interviewDetails.notes,
    };
    await job.save();

    // Send notification message to applicant
    const notificationMessage = new Message({
      from: req.employer._id,
      to: applicantId,
      fromModel: "Employer",
      toModel: "User",
      jobId: jobId,
      content: `You have been invited for an interview for the position of ${job.jobTitle}. Please check your interview invitations to respond.`,
      messageType: "interview_invite",
    });

    await notificationMessage.save();

    // Mark notification as sent
    invitation.notifications.invitationSent = true;
    await invitation.save();

    // Populate the invitation for response
    const populatedInvitation = await InterviewInvitation.findById(
      invitation._id
    )
      .populate("job", "jobTitle companyName")
      .populate("employer", "companyName email")
      .populate("applicant", "name email");

    res.status(201).json({
      success: true,
      message: "Interview invitation sent successfully",
      invitation: populatedInvitation,
    });
  } catch (error) {
    console.error("Error sending interview invitation:", error);
    next(error);
  }
};

/**
 * @desc    Get interview invitations for applicant
 * @route   GET /api/interviews/my-invitations
 * @access  Private (User only)
 */
export const getMyInterviewInvitations = async (req, res, next) => {
  try {
    console.log("getMyInterviewInvitations called");
    console.log("User ID:", req.user?.id);
    console.log("Query params:", req.query);

    const { status } = req.query;

    let query = { applicantId: req.user.id };
    if (status) {
      query.status = status;
    }

    console.log("Database query:", query);

    const invitations = await InterviewInvitation.find(query)
      .populate({
        path: "jobId",
        select: "jobTitle companyName jobLocation",
        model: "Job",
      })
      .populate({
        path: "employerId",
        select: "companyName email",
        model: "Employer",
      })
      .sort({ createdAt: -1 });

    console.log("Found invitations:", invitations.length);

    // Transform the data to match frontend expectations
    const transformedInvitations = invitations.map((invitation) => ({
      ...invitation.toObject(),
      job: invitation.jobId, // Map jobId to job for consistency
      employer: invitation.employerId, // Map employerId to employer for consistency
    }));

    res.json({
      success: true,
      count: transformedInvitations.length,
      invitations: transformedInvitations,
    });
  } catch (error) {
    console.error("Error fetching interview invitations:", error);
    next(error);
  }
};

/**
 * @desc    Get interview invitations sent by employer
 * @route   GET /api/interviews/sent-invitations
 * @access  Private (Employer only)
 */
export const getSentInterviewInvitations = async (req, res, next) => {
  try {
    console.log("getSentInterviewInvitations called");
    console.log("Employer ID:", req.employer?._id);

    const { status, jobId } = req.query;

    let query = { employerId: req.employer._id };
    if (status) {
      query.status = status;
    }
    if (jobId) {
      query.jobId = jobId;
    }

    console.log("Database query:", query);

    const invitations = await InterviewInvitation.find(query)
      .populate("job", "jobTitle companyName")
      .populate({
        path: "applicantId",
        select: "name email",
        model: "User",
      })
      .sort({ createdAt: -1 });

    console.log("Found invitations:", invitations.length);

    // Transform the data to match frontend expectations
    const transformedInvitations = invitations.map((invitation) => ({
      ...invitation.toObject(),
      applicant: invitation.applicantId, // Map applicantId to applicant for consistency
    }));

    res.json({
      success: true,
      count: transformedInvitations.length,
      invitations: transformedInvitations,
    });
  } catch (error) {
    console.error("Error fetching sent interview invitations:", error);
    next(error);
  }
};

/**
 * @desc    Respond to interview invitation (Accept/Decline/Request Reschedule)
 * @route   PUT /api/interviews/:invitationId/respond
 * @access  Private (User only)
 */
export const respondToInterviewInvitation = async (req, res, next) => {
  try {
    const { invitationId } = req.params;
    const { action, message, rescheduleReason, suggestedTimes } = req.body;

    // Validate action
    if (!["accept", "decline", "reschedule"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action. Must be accept, decline, or reschedule",
      });
    }

    // Find invitation
    const invitation = await InterviewInvitation.findById(invitationId)
      .populate("job")
      .populate("employer");

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: "Interview invitation not found",
      });
    }

    // Verify user is the applicant
    if (invitation.applicantId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to respond to this invitation",
      });
    }

    // Check if invitation is still pending
    if (invitation.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "This invitation has already been responded to",
      });
    }

    // Update invitation based on action
    invitation.applicantResponse = {
      respondedAt: new Date(),
      message: message || "",
      rescheduleReason: action === "reschedule" ? rescheduleReason : undefined,
      suggestedTimes: action === "reschedule" ? suggestedTimes : undefined,
    };

    // Set status based on action
    switch (action) {
      case "accept":
        invitation.status = "accepted";
        break;
      case "decline":
        invitation.status = "declined";
        break;
      case "reschedule":
        invitation.status = "reschedule_requested";
        if (
          !rescheduleReason ||
          !suggestedTimes ||
          suggestedTimes.length === 0
        ) {
          return res.status(400).json({
            success: false,
            message: "Reschedule reason and suggested times are required",
          });
        }
        break;
    }

    await invitation.save();

    // Send comprehensive notifications to employer
    try {
      const applicant = await User.findById(req.user.id);
      const employer = await Employer.findById(invitation.employerId);

      if (applicant && employer) {
        await sendInterviewResponseNotification(
          invitation,
          applicant,
          employer,
          invitation.job,
          action
        );
      }
    } catch (notificationError) {
      console.error(
        "Error sending interview response notification:",
        notificationError
      );
      // Don't fail the request if notification fails
    }

    // Mark response notification as sent
    invitation.notifications.responseSent = true;
    await invitation.save();

    res.json({
      success: true,
      message: `Interview invitation ${action}ed successfully`,
      invitation,
    });
  } catch (error) {
    console.error("Error responding to interview invitation:", error);
    next(error);
  }
};

/**
 * @desc    Employer responds to reschedule request
 * @route   PUT /api/interviews/:invitationId/reschedule-response
 * @access  Private (Employer only)
 */
export const respondToRescheduleRequest = async (req, res, next) => {
  try {
    const { invitationId } = req.params;
    const { action, message, selectedTime } = req.body;

    // Validate action
    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action. Must be approve or reject",
      });
    }

    // Find invitation
    const invitation = await InterviewInvitation.findById(invitationId)
      .populate("job")
      .populate("applicant");

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: "Interview invitation not found",
      });
    }

    // Verify employer owns the invitation
    if (invitation.employerId.toString() !== req.employer._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to respond to this reschedule request",
      });
    }

    // Check if invitation is in reschedule_requested status
    if (invitation.status !== "reschedule_requested") {
      return res.status(400).json({
        success: false,
        message: "No reschedule request found for this invitation",
      });
    }

    if (action === "approve") {
      if (!selectedTime || !selectedTime.date || !selectedTime.time) {
        return res.status(400).json({
          success: false,
          message: "Selected time is required when approving reschedule",
        });
      }

      // Update interview details with new time
      invitation.interviewDetails.date = new Date(selectedTime.date);
      invitation.interviewDetails.time = selectedTime.time;
      invitation.status = "rescheduled";
      invitation.isRescheduled = true;

      // Update employer response
      invitation.employerResponse = {
        respondedAt: new Date(),
        message: message || "",
        acceptedSuggestedTime: selectedTime,
      };

      // Update the job application's interview details
      const job = await Job.findById(invitation.jobId);
      const application = job.applicants.id(invitation.applicationId);
      if (application) {
        application.interviewDetails.date = selectedTime.date;
        application.interviewDetails.time = selectedTime.time;
        await job.save();
      }
    } else {
      // reject
      invitation.status = "declined";
      invitation.employerResponse = {
        respondedAt: new Date(),
        message: message || "Reschedule request rejected",
      };
    }

    await invitation.save();

    // Send comprehensive notifications to applicant about date/time change
    try {
      const applicant = await User.findById(invitation.applicantId);
      const employer = await Employer.findById(req.employer._id);

      if (applicant && employer) {
        const oldDetails =
          action === "approve"
            ? {
                date: invitation.interviewDetails.date,
                time: invitation.interviewDetails.time,
              }
            : null;

        const updateType =
          action === "approve" ? "reschedule_approved" : "reschedule_rejected";
        await sendInterviewUpdateNotification(
          invitation,
          applicant,
          employer,
          invitation.job,
          updateType,
          oldDetails
        );
      }
    } catch (notificationError) {
      console.error(
        "Error sending reschedule response notification:",
        notificationError
      );
      // Don't fail the request if notification fails
    }

    res.json({
      success: true,
      message: `Reschedule request ${action}d successfully`,
      invitation,
    });
  } catch (error) {
    console.error("Error responding to reschedule request:", error);
    next(error);
  }
};

/**
 * @desc    Get upcoming interviews for user or employer
 * @route   GET /api/interviews/upcoming
 * @access  Private (User or Employer)
 */
export const getUpcomingInterviews = async (req, res, next) => {
  try {
    let query = {};
    let populateFields = [];

    // Determine if request is from user or employer
    if (req.user) {
      // User request
      query = {
        applicantId: req.user.id,
        status: { $in: ["accepted", "rescheduled"] },
        "interviewDetails.date": { $gte: new Date() },
      };
      populateFields = [
        { path: "job", select: "jobTitle companyName" },
        { path: "employer", select: "companyName email" },
      ];
    } else if (req.employer) {
      // Employer request
      query = {
        employerId: req.employer._id,
        status: { $in: ["accepted", "rescheduled"] },
        "interviewDetails.date": { $gte: new Date() },
      };
      populateFields = [
        { path: "job", select: "jobTitle" },
        { path: "applicant", select: "name email" },
      ];
    } else {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const interviews = await InterviewInvitation.find(query)
      .populate(populateFields)
      .sort({ "interviewDetails.date": 1 });

    res.json({
      success: true,
      count: interviews.length,
      interviews,
    });
  } catch (error) {
    console.error("Error fetching upcoming interviews:", error);
    next(error);
  }
};

/**
 * @desc    Update interview date/time (Employer only)
 * @route   PUT /api/interviews/:invitationId/update-time
 * @access  Private (Employer only)
 */
export const updateInterviewTime = async (req, res, next) => {
  try {
    const { invitationId } = req.params;
    const { date, time, reason } = req.body;

    // Validate required fields
    if (!date || !time) {
      return res.status(400).json({
        success: false,
        message: "Date and time are required",
      });
    }

    // Find invitation
    const invitation = await InterviewInvitation.findById(invitationId)
      .populate("job")
      .populate("applicant");

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: "Interview invitation not found",
      });
    }

    // Verify employer owns this invitation
    if (invitation.employerId.toString() !== req.employer._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this interview",
      });
    }

    // Store old details for notification
    const oldDetails = {
      date: invitation.interviewDetails.date,
      time: invitation.interviewDetails.time,
    };

    // Update interview details
    invitation.interviewDetails.date = new Date(date);
    invitation.interviewDetails.time = time;
    invitation.isRescheduled = true;

    // Add update history
    if (!invitation.updateHistory) {
      invitation.updateHistory = [];
    }
    invitation.updateHistory.push({
      date: new Date(),
      updatedBy: req.employer._id,
      oldDate: oldDetails.date,
      oldTime: oldDetails.time,
      newDate: date,
      newTime: time,
      reason: reason || "Interview time updated by employer",
    });

    await invitation.save();

    // Update the job application's interview details
    const job = await Job.findById(invitation.jobId);
    const application = job.applicants.id(invitation.applicationId);
    if (application) {
      application.interviewDetails.date = date;
      application.interviewDetails.time = time;
      await job.save();
    }

    // Send comprehensive notifications to applicant about date/time change
    try {
      const applicant = await User.findById(invitation.applicantId);
      const employer = await Employer.findById(req.employer._id);

      if (applicant && employer) {
        await sendInterviewUpdateNotification(
          invitation,
          applicant,
          employer,
          invitation.job,
          "date_time_changed",
          oldDetails
        );
      }
    } catch (notificationError) {
      console.error(
        "Error sending interview time update notification:",
        notificationError
      );
      // Don't fail the request if notification fails
    }

    res.json({
      success: true,
      message: "Interview time updated successfully",
      invitation,
    });
  } catch (error) {
    console.error("Error updating interview time:", error);
    next(error);
  }
};

/**
 * @desc    Cancel interview invitation
 * @route   DELETE /api/interviews/:invitationId/cancel
 * @access  Private (Employer only)
 */
export const cancelInterviewInvitation = async (req, res, next) => {
  try {
    const { invitationId } = req.params;
    const { reason } = req.body;

    const invitation = await InterviewInvitation.findById(invitationId)
      .populate("job")
      .populate("applicant");

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: "Interview invitation not found",
      });
    }

    // Verify employer owns the invitation
    if (invitation.employerId.toString() !== req.employer._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to cancel this invitation",
      });
    }

    // Update status to cancelled
    invitation.status = "cancelled";
    invitation.employerResponse = {
      respondedAt: new Date(),
      message: reason || "Interview cancelled by employer",
    };

    await invitation.save();

    // Send comprehensive notifications to applicant about cancellation
    try {
      const applicant = await User.findById(invitation.applicantId);
      const employer = await Employer.findById(req.employer._id);

      if (applicant && employer) {
        await sendInterviewUpdateNotification(
          invitation,
          applicant,
          employer,
          invitation.job,
          "cancelled"
        );
      }
    } catch (notificationError) {
      console.error(
        "Error sending interview cancellation notification:",
        notificationError
      );
      // Don't fail the request if notification fails
    }

    res.json({
      success: true,
      message: "Interview invitation cancelled successfully",
    });
  } catch (error) {
    console.error("Error cancelling interview invitation:", error);
    next(error);
  }
};

/**
 * Send interview update notification and email to applicant
 */
const sendInterviewUpdateNotification = async (
  invitation,
  applicant,
  employer,
  job,
  updateType,
  oldDetails = null
) => {
  try {
    console.log(
      `📧 Sending interview ${updateType} notification to: ${applicant.email}`
    );

    // Create notification for the applicant
    const notificationData = {
      userId: applicant._id,
      type: "interview_invitation",
      title: getNotificationTitle(updateType),
      message: getNotificationMessage(
        updateType,
        invitation,
        job,
        employer,
        oldDetails
      ),
      priority: "high",
      metadata: {
        jobId: job._id,
        employerId: employer._id,
        interviewId: invitation._id,
      },
    };

    // Create notification in database
    await createNotification(notificationData);

    // Send email notification
    // await sendInterviewUpdateEmail(
    //   applicant,
    //   employer,
    //   job,
    //   invitation,
    //   updateType,
    //   oldDetails
    // );

    console.log(
      `✅ Interview ${updateType} notification sent successfully to: ${applicant.email}`
    );
  } catch (error) {
    console.error(
      `❌ Error sending interview ${updateType} notification:`,
      error
    );
    throw error;
  }
};

/**
 * Send interview response notification to employer
 */
const sendInterviewResponseNotification = async (
  invitation,
  applicant,
  employer,
  job,
  action
) => {
  try {
    console.log(
      `📧 Sending interview response notification to employer: ${employer.email}`
    );

    // Create notification for the employer
    const notificationData = {
      userId: employer._id,
      type: "application_update",
      title: getResponseNotificationTitle(action),
      message: getResponseNotificationMessage(
        action,
        invitation,
        job,
        applicant
      ),
      priority: "medium",
      metadata: {
        jobId: job._id,
        employerId: employer._id,
        interviewId: invitation._id,
      },
    };

    // Create notification in database
    await createNotification(notificationData);

    // Send email notification to employer
    // await sendInterviewResponseEmail(
    //   employer,
    //   applicant,
    //   job,
    //   invitation,
    //   action
    // );

    console.log(
      `✅ Interview response notification sent successfully to employer: ${employer.email}`
    );
  } catch (error) {
    console.error(`❌ Error sending interview response notification:`, error);
    throw error;
  }
};

/**
 * Send interview update email to applicant
 */
const sendInterviewUpdateEmail = async (
  applicant,
  employer,
  job,
  invitation,
  updateType,
  oldDetails = null
) => {
  try {
    const transporter = createTransporter();

    const companyName = employer.companyName || "Our Company";
    const jobTitle = job.jobTitle;
    const newDate = new Date(
      invitation.interviewDetails.date
    ).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const newTime = invitation.interviewDetails.time;
    const location = invitation.interviewDetails.location;
    const interviewType = invitation.interviewDetails.interviewType;
    const notes = invitation.interviewDetails.notes || "";

    let subject = "";
    let emailBody = "";

    switch (updateType) {
      case "date_time_changed":
        const oldDate = oldDetails
          ? new Date(oldDetails.date).toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : "";
        const oldTime = oldDetails ? oldDetails.time : "";

        subject = `📅 Interview Rescheduled: ${jobTitle} at ${companyName}`;
        emailBody = `
Dear ${applicant.name},

Your interview for the ${jobTitle} position at ${companyName} has been rescheduled.

🔄 **Schedule Change:**
- **Previous:** ${oldDate} at ${oldTime}
- **New:** ${newDate} at ${newTime}
- **Location:** ${location}
- **Type:** ${interviewType}

${notes ? `📝 **Additional Notes:** ${notes}` : ""}

Please update your calendar and confirm your availability for the new time.

If you have any conflicts with this new schedule, please contact us immediately.

Best regards,
${companyName} Team

---
This is an automated message from FindX. Please do not reply to this email.
        `;
        break;

      case "cancelled":
        subject = `❌ Interview Cancelled: ${jobTitle} at ${companyName}`;
        emailBody = `
Dear ${applicant.name},

Your interview for the ${jobTitle} position at ${companyName} has been cancelled.

📅 **Cancelled Interview Details:**
- **Date:** ${newDate}
- **Time:** ${newTime}
- **Location:** ${location}

${notes ? `📝 **Reason:** ${notes}` : ""}

We apologize for any inconvenience this may cause. We will contact you if we need to reschedule.

Best regards,
${companyName} Team

---
This is an automated message from FindX. Please do not reply to this email.
        `;
        break;

      default:
        subject = `📅 Interview Update: ${jobTitle} at ${companyName}`;
        emailBody = `
Dear ${applicant.name},

Your interview for the ${jobTitle} position at ${companyName} has been updated.

📅 **Interview Details:**
- **Date:** ${newDate}
- **Time:** ${newTime}
- **Location:** ${location}
- **Type:** ${interviewType}

${notes ? `📝 **Notes:** ${notes}` : ""}

Please review the updated details and confirm your availability.

Best regards,
${companyName} Team

---
This is an automated message from FindX. Please do not reply to this email.
        `;
    }

    const mailOptions = {
      from: {
        name: "FindX Job Alerts",
        address: process.env.SMTP_USER,
      },
      to: applicant.email,
      subject: subject,
      text: emailBody,
      html: emailBody.replace(/\n/g, "<br>"),
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Interview update email sent to: ${applicant.email}`);
  } catch (error) {
    console.error(`❌ Error sending interview update email:`, error);
    throw error;
  }
};

/**
 * Send interview response email to employer
 */
const sendInterviewResponseEmail = async (
  employer,
  applicant,
  job,
  invitation,
  action
) => {
  try {
    const transporter = createTransporter();

    const companyName = employer.companyName || "Your Company";
    const jobTitle = job.jobTitle;
    const applicantName = applicant.name;
    const responseMessage = invitation.applicantResponse?.message || "";

    let subject = "";
    let emailBody = "";

    switch (action) {
      case "accept":
        subject = `✅ Interview Accepted: ${applicantName} for ${jobTitle}`;
        emailBody = `
Dear ${companyName} Team,

Great news! ${applicantName} has accepted the interview invitation for the ${jobTitle} position.

📅 **Interview Details:**
- **Date:** ${new Date(invitation.interviewDetails.date).toLocaleDateString(
          "en-US",
          {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          }
        )}
- **Time:** ${invitation.interviewDetails.time}
- **Location:** ${invitation.interviewDetails.location}
- **Type:** ${invitation.interviewDetails.interviewType}

${responseMessage ? `💬 **Applicant's Message:** ${responseMessage}` : ""}

The applicant is confirmed for this interview. Please prepare accordingly.

Best regards,
FindX Team

---
This is an automated message from FindX. Please do not reply to this email.
        `;
        break;

      case "decline":
        subject = `❌ Interview Declined: ${applicantName} for ${jobTitle}`;
        emailBody = `
Dear ${companyName} Team,

${applicantName} has declined the interview invitation for the ${jobTitle} position.

${responseMessage ? `💬 **Applicant's Message:** ${responseMessage}` : ""}

You may want to consider other candidates for this position.

Best regards,
FindX Team

---
This is an automated message from FindX. Please do not reply to this email.
        `;
        break;

      case "reschedule":
        subject = `🔄 Reschedule Request: ${applicantName} for ${jobTitle}`;
        emailBody = `
Dear ${companyName} Team,

${applicantName} has requested to reschedule the interview for the ${jobTitle} position.

📅 **Current Interview:**
- **Date:** ${new Date(invitation.interviewDetails.date).toLocaleDateString(
          "en-US",
          {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          }
        )}
- **Time:** ${invitation.interviewDetails.time}

💬 **Reschedule Reason:** ${
          invitation.applicantResponse?.rescheduleReason || "No reason provided"
        }

📋 **Suggested Times:**
${
  invitation.applicantResponse?.suggestedTimes
    ?.map(
      (time, index) =>
        `${index + 1}. ${new Date(time.date).toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })} at ${time.time}${time.notes ? ` - ${time.notes}` : ""}`
    )
    .join("\n") || "No suggested times provided"
}

${responseMessage ? `💬 **Additional Message:** ${responseMessage}` : ""}

Please review the suggested times and respond accordingly.

Best regards,
FindX Team

---
This is an automated message from FindX. Please do not reply to this email.
        `;
        break;

      default:
        subject = `📧 Interview Response: ${applicantName} for ${jobTitle}`;
        emailBody = `
Dear ${companyName} Team,

${applicantName} has responded to the interview invitation for the ${jobTitle} position.

**Response:** ${action}

${responseMessage ? `💬 **Message:** ${responseMessage}` : ""}

Please check your FindX dashboard for more details.

Best regards,
FindX Team

---
This is an automated message from FindX. Please do not reply to this email.
        `;
    }

    const mailOptions = {
      from: process.env.SMTP_USER,
      to: employer.email,
      subject: subject,
      text: emailBody,
      html: emailBody.replace(/\n/g, "<br>"),
    };

    await transporter.sendMail(mailOptions);
    console.log(
      `✅ Interview response email sent to employer: ${employer.email}`
    );
  } catch (error) {
    console.error(`❌ Error sending interview response email:`, error);
    throw error;
  }
};

/**
 * Helper functions for notification titles and messages
 */
const getNotificationTitle = (updateType) => {
  switch (updateType) {
    case "date_time_changed":
      return "Interview Rescheduled";
    case "cancelled":
      return "Interview Cancelled";
    default:
      return "Interview Update";
  }
};

const getNotificationMessage = (
  updateType,
  invitation,
  job,
  employer,
  oldDetails
) => {
  const companyName = employer.companyName || "Company";
  const jobTitle = job.jobTitle;
  const newDate = new Date(invitation.interviewDetails.date).toLocaleDateString(
    "en-US",
    {
      weekday: "short",
      month: "short",
      day: "numeric",
    }
  );
  const newTime = invitation.interviewDetails.time;

  switch (updateType) {
    case "date_time_changed":
      const oldDate = oldDetails
        ? new Date(oldDetails.date).toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          })
        : "";
      const oldTime = oldDetails ? oldDetails.time : "";
      return `Your interview for ${jobTitle} at ${companyName} has been rescheduled from ${oldDate} ${oldTime} to ${newDate} ${newTime}.`;

    case "cancelled":
      return `Your interview for ${jobTitle} at ${companyName} scheduled for ${newDate} ${newTime} has been cancelled.`;

    default:
      return `Your interview for ${jobTitle} at ${companyName} has been updated. New time: ${newDate} ${newTime}.`;
  }
};

const getResponseNotificationTitle = (action) => {
  switch (action) {
    case "accept":
      return "Interview Accepted";
    case "decline":
      return "Interview Declined";
    case "reschedule":
      return "Reschedule Request";
    default:
      return "Interview Response";
  }
};

const getResponseNotificationMessage = (action, invitation, job, applicant) => {
  const applicantName = applicant.name;
  const jobTitle = job.jobTitle;

  switch (action) {
    case "accept":
      return `${applicantName} has accepted the interview invitation for ${jobTitle}.`;
    case "decline":
      return `${applicantName} has declined the interview invitation for ${jobTitle}.`;
    case "reschedule":
      return `${applicantName} has requested to reschedule the interview for ${jobTitle}.`;
    default:
      return `${applicantName} has responded to the interview invitation for ${jobTitle}.`;
  }
};

 
