import mongoose from 'mongoose';

const DOMAIN_NAMES = [
    'Accounting',
    'Administration & Office Support',
    'Advertising, Arts & Media',
    'Banking & Financial Services',
    'Call Centre & Customer Service',
    'CEO & General Management',
    'Community Services & Development',
    'Construction',
    'Consulting & Strategy',
    'Design & Architecture',
    'Education & Training',
    'Engineering',
    'Farming, Animals & Conservation',
    'Government & Defence',
    'Emergency Services',
    'Healthcare & Medical',
    'Hospitality & Tourism',
    'Human Resources & Recruitment',
    'Information & Communication',
    'Insurance & Superannuation',
    'Legal',
    'Manufacturing, Transport & Logistics',
    'Marketing & Communications',
    'Mining, Resources & Energy',
    'Real Estate & Property',
    'Retail & Consumer Products',
    'Sales',
    'Science & Technology',
    'Self Employment',
    'Sport & Recreation',
    'Trades & Services'
];

const domainSchema = new mongoose.Schema({
    name: {
        type: String,
        enum: DOMAIN_NAMES,
        required: true,
        unique: true
    },
    userEmails: {
        type: [String],
        default: []
    }
}, { timestamps: true });

const Domain = mongoose.model('Domain', domainSchema);
export default Domain; 