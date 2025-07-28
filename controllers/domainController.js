import Domain from "../models/Domain.model";
import User from "../models/User";
// Update domain for authenticated user
const updateMyDomain = async (req, res, next) => {
    try {
        const { domain } = req.body;
        const userId = req.user.id; // Get user ID from auth middleware

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Validate that the domain is one of the predefined domains
        const validDomains = Domain.schema.path('name').enumValues;
        if (!validDomains.includes(domain)) {
            return res.status(400).json({ 
                message: "Invalid domain", 
                validDomains: validDomains 
            });
        }

        // Store the previous domain to remove user email from it
        const previousDomain = user.work_domain;

        // Update user's work domain
        user.work_domain = domain;
        await user.save();

        // Remove user email from previous domain if it exists
        if (previousDomain && previousDomain !== domain) {
            await Domain.findOneAndUpdate(
                { name: previousDomain },
                { $pull: { userEmails: user.email } }
            );
        }

        // Add user email to the new domain
        await Domain.findOneAndUpdate(
            { name: domain },
            { $addToSet: { userEmails: user.email } },
            { upsert: true }
        );

        return res.status(200).json({ 
            success: true,
            message: "User domain updated successfully",
            user: user
        });
    } catch (error) {
        console.error("Error updating user domain:", error);
        return res.status(500).json({ message: "Error updating user domain" });
    }
};

export { updateUserDomain, updateMyDomain, getAllDomains, initializeDomains };