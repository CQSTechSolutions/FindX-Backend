import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
    try {
        let token;

        // Check if token exists in Authorization header
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
            console.log('🔑 Token found in Authorization header');
        }

        if (!token) {
            console.log('❌ No token found in request');
            return res.status(401).json({
                success: false,
                message: 'Not authorized to access this route'
            });
        }

        try {
            console.log('🔍 Verifying token...');
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            console.log('✅ Token verified, user ID:', decoded.id);
            
            const user = await User.findById(decoded.id);

            if (!user) {
                console.log('❌ User not found for ID:', decoded.id);
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            console.log('✅ User found:', user._id);
            req.user = user;
            next();
        } catch (error) {
            console.error('❌ Token verification failed:', error.message);
            return res.status(401).json({
                success: false,
                message: 'Not authorized to access this route'
            });
        }
    } catch (error) {
        console.error('❌ Auth middleware error:', error);
        next(error);
    }
};
