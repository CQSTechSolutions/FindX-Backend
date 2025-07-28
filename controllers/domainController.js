import Domain from "../models/Domain.model.js";
import User from "../models/User.js";

// Initialize predefined domains
const initializeDomains = async () => {
    try {
        // Get the domain names from the model schema
        const DOMAIN_NAMES = Domain.schema.path('name').enumValues;

        for (const domainName of DOMAIN_NAMES) {
            await Domain.findOneAndUpdate(
                { name: domainName },
                { name: domainName },
                { upsert: true }
            );
        }
        console.log('Domains initialized successfully');
    } catch (error) {
        console.error('Error initializing domains:', error);
    }
};

// Get all domains
const getAllDomains = async (req, res, next) => {
    try {
        const domains = await Domain.find({}).sort({ name: 1 });
        return res.status(200).json({ domains });
    } catch (error) {
        console.error("Error fetching domains:", error);
        return res.status(500).json({ message: "Error fetching domains" });
    }
};

// Update user domain (admin endpoint)
const updateUserDomain = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { domain } = req.body;

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

// Validate user has a domain assigned
const validateUserDomain = async (userId) => {
    try {
        const user = await User.findById(userId);
        if (!user) {
            return { valid: false, message: "User not found" };
        }
        
        if (!user.work_domain) {
            return { valid: false, message: "User has no domain assigned" };
        }
        
        // Check if the domain exists in our predefined domains
        const validDomains = Domain.schema.path('name').enumValues;
        if (!validDomains.includes(user.work_domain)) {
            return { valid: false, message: "User has invalid domain assigned" };
        }
        
        return { valid: true, user };
    } catch (error) {
        console.error("Error validating user domain:", error);
        return { valid: false, message: "Error validating user domain" };
    }
};

export { updateUserDomain, updateMyDomain, getAllDomains, initializeDomains, validateUserDomain };