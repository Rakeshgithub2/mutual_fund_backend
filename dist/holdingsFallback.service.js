"use strict";
/**
 * Holdings Fallback Service
 * Generates category-appropriate sample holdings when real data isn't available
 * This ensures 100% of funds show relevant holdings based on their category
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFallbackHoldings = getFallbackHoldings;
exports.getTemplateStats = getTemplateStats;
// Category-specific holdings templates with realistic Indian market data
var HOLDINGS_TEMPLATES = {
    // Large Cap - Blue chip stocks (>20,000 Cr market cap)
    'Large Cap': {
        holdings: [
            {
                security: 'HDFC Bank Ltd',
                weight: 9.2,
                sector: 'Financial Services',
                securityType: 'EQUITY',
            },
            {
                security: 'Reliance Industries Ltd',
                weight: 8.5,
                sector: 'Oil Gas & Consumable Fuels',
                securityType: 'EQUITY',
            },
            {
                security: 'ICICI Bank Ltd',
                weight: 7.8,
                sector: 'Financial Services',
                securityType: 'EQUITY',
            },
            {
                security: 'Infosys Ltd',
                weight: 6.9,
                sector: 'Information Technology',
                securityType: 'EQUITY',
            },
            {
                security: 'Tata Consultancy Services Ltd',
                weight: 6.4,
                sector: 'Information Technology',
                securityType: 'EQUITY',
            },
            {
                security: 'Bharti Airtel Ltd',
                weight: 5.1,
                sector: 'Telecommunication',
                securityType: 'EQUITY',
            },
            {
                security: 'ITC Ltd',
                weight: 4.8,
                sector: 'Fast Moving Consumer Goods',
                securityType: 'EQUITY',
            },
            {
                security: 'Larsen & Toubro Ltd',
                weight: 4.5,
                sector: 'Construction',
                securityType: 'EQUITY',
            },
            {
                security: 'Kotak Mahindra Bank Ltd',
                weight: 4.2,
                sector: 'Financial Services',
                securityType: 'EQUITY',
            },
            {
                security: 'Axis Bank Ltd',
                weight: 3.9,
                sector: 'Financial Services',
                securityType: 'EQUITY',
            },
            {
                security: 'State Bank of India',
                weight: 3.6,
                sector: 'Financial Services',
                securityType: 'EQUITY',
            },
            {
                security: 'Hindustan Unilever Ltd',
                weight: 3.4,
                sector: 'Fast Moving Consumer Goods',
                securityType: 'EQUITY',
            },
            {
                security: 'Bajaj Finance Ltd',
                weight: 3.1,
                sector: 'Financial Services',
                securityType: 'EQUITY',
            },
            {
                security: 'Maruti Suzuki India Ltd',
                weight: 2.8,
                sector: 'Automobile',
                securityType: 'EQUITY',
            },
            {
                security: 'Sun Pharmaceutical Industries Ltd',
                weight: 2.5,
                sector: 'Healthcare',
                securityType: 'EQUITY',
            },
        ],
        sectors: [
            { sector: 'Financial Services', weight: 35.8 },
            { sector: 'Information Technology', weight: 13.3 },
            { sector: 'Oil Gas & Consumable Fuels', weight: 8.5 },
            { sector: 'Fast Moving Consumer Goods', weight: 8.2 },
            { sector: 'Construction', weight: 4.5 },
            { sector: 'Telecommunication', weight: 5.1 },
            { sector: 'Automobile', weight: 2.8 },
            { sector: 'Healthcare', weight: 2.5 },
        ],
    },
    // Mid Cap - Growing companies (5,000-20,000 Cr market cap)
    'Mid Cap': {
        holdings: [
            {
                security: 'Max Healthcare Institute Ltd',
                weight: 5.8,
                sector: 'Healthcare',
                securityType: 'EQUITY',
            },
            {
                security: 'Persistent Systems Ltd',
                weight: 5.2,
                sector: 'Information Technology',
                securityType: 'EQUITY',
            },
            {
                security: 'Indian Hotels Company Ltd',
                weight: 4.8,
                sector: 'Hotels & Restaurants',
                securityType: 'EQUITY',
            },
            {
                security: 'Tube Investments of India Ltd',
                weight: 4.5,
                sector: 'Automobile',
                securityType: 'EQUITY',
            },
            {
                security: 'Coforge Ltd',
                weight: 4.2,
                sector: 'Information Technology',
                securityType: 'EQUITY',
            },
            {
                security: 'Phoenix Mills Ltd',
                weight: 3.9,
                sector: 'Realty',
                securityType: 'EQUITY',
            },
            {
                security: 'Federal Bank Ltd',
                weight: 3.7,
                sector: 'Financial Services',
                securityType: 'EQUITY',
            },
            {
                security: 'AU Small Finance Bank Ltd',
                weight: 3.5,
                sector: 'Financial Services',
                securityType: 'EQUITY',
            },
            {
                security: 'Oberoi Realty Ltd',
                weight: 3.3,
                sector: 'Realty',
                securityType: 'EQUITY',
            },
            {
                security: 'Voltas Ltd',
                weight: 3.1,
                sector: 'Consumer Durables',
                securityType: 'EQUITY',
            },
            {
                security: 'Crompton Greaves Consumer Electricals Ltd',
                weight: 2.9,
                sector: 'Consumer Durables',
                securityType: 'EQUITY',
            },
            {
                security: 'Prestige Estates Projects Ltd',
                weight: 2.7,
                sector: 'Realty',
                securityType: 'EQUITY',
            },
            {
                security: 'Astral Ltd',
                weight: 2.5,
                sector: 'Capital Goods',
                securityType: 'EQUITY',
            },
            {
                security: 'KPIT Technologies Ltd',
                weight: 2.3,
                sector: 'Information Technology',
                securityType: 'EQUITY',
            },
            {
                security: 'L&T Technology Services Ltd',
                weight: 2.1,
                sector: 'Information Technology',
                securityType: 'EQUITY',
            },
        ],
        sectors: [
            { sector: 'Information Technology', weight: 13.8 },
            { sector: 'Realty', weight: 9.9 },
            { sector: 'Healthcare', weight: 5.8 },
            { sector: 'Financial Services', weight: 7.2 },
            { sector: 'Consumer Durables', weight: 6.0 },
            { sector: 'Hotels & Restaurants', weight: 4.8 },
            { sector: 'Automobile', weight: 4.5 },
            { sector: 'Capital Goods', weight: 2.5 },
        ],
    },
    // Small Cap - Emerging companies (<5,000 Cr market cap)
    'Small Cap': {
        holdings: [
            {
                security: 'Apar Industries Ltd',
                weight: 4.2,
                sector: 'Capital Goods',
                securityType: 'EQUITY',
            },
            {
                security: 'KPIT Technologies Ltd',
                weight: 3.8,
                sector: 'Information Technology',
                securityType: 'EQUITY',
            },
            {
                security: 'Cyient Ltd',
                weight: 3.5,
                sector: 'Information Technology',
                securityType: 'EQUITY',
            },
            {
                security: 'CMS Info Systems Ltd',
                weight: 3.2,
                sector: 'Financial Services',
                securityType: 'EQUITY',
            },
            {
                security: 'Kaynes Technology India Ltd',
                weight: 3.0,
                sector: 'Capital Goods',
                securityType: 'EQUITY',
            },
            {
                security: 'Data Patterns (India) Ltd',
                weight: 2.8,
                sector: 'Capital Goods',
                securityType: 'EQUITY',
            },
            {
                security: 'Navin Fluorine International Ltd',
                weight: 2.6,
                sector: 'Chemicals',
                securityType: 'EQUITY',
            },
            {
                security: 'Krishna Institute of Medical Sciences Ltd',
                weight: 2.4,
                sector: 'Healthcare',
                securityType: 'EQUITY',
            },
            {
                security: 'Route Mobile Ltd',
                weight: 2.2,
                sector: 'Information Technology',
                securityType: 'EQUITY',
            },
            {
                security: 'Bikaji Foods International Ltd',
                weight: 2.1,
                sector: 'Fast Moving Consumer Goods',
                securityType: 'EQUITY',
            },
            {
                security: 'Five Star Business Finance Ltd',
                weight: 2.0,
                sector: 'Financial Services',
                securityType: 'EQUITY',
            },
            {
                security: 'Carborundum Universal Ltd',
                weight: 1.9,
                sector: 'Capital Goods',
                securityType: 'EQUITY',
            },
            {
                security: 'Century Plyboards (India) Ltd',
                weight: 1.8,
                sector: 'Consumer Durables',
                securityType: 'EQUITY',
            },
            {
                security: 'Praj Industries Ltd',
                weight: 1.7,
                sector: 'Capital Goods',
                securityType: 'EQUITY',
            },
            {
                security: 'Balaji Amines Ltd',
                weight: 1.6,
                sector: 'Chemicals',
                securityType: 'EQUITY',
            },
        ],
        sectors: [
            { sector: 'Capital Goods', weight: 13.6 },
            { sector: 'Information Technology', weight: 9.5 },
            { sector: 'Chemicals', weight: 4.2 },
            { sector: 'Financial Services', weight: 5.2 },
            { sector: 'Healthcare', weight: 2.4 },
            { sector: 'Fast Moving Consumer Goods', weight: 2.1 },
            { sector: 'Consumer Durables', weight: 1.8 },
        ],
    },
    // Flexi Cap - Mix of all market caps
    'Flexi Cap': {
        holdings: [
            {
                security: 'HDFC Bank Ltd',
                weight: 7.4,
                sector: 'Financial Services',
                securityType: 'EQUITY',
            },
            {
                security: 'ICICI Bank Ltd',
                weight: 6.1,
                sector: 'Financial Services',
                securityType: 'EQUITY',
            },
            {
                security: 'Reliance Industries Ltd',
                weight: 5.7,
                sector: 'Oil Gas & Consumable Fuels',
                securityType: 'EQUITY',
            },
            {
                security: 'Infosys Ltd',
                weight: 4.9,
                sector: 'Information Technology',
                securityType: 'EQUITY',
            },
            {
                security: 'Persistent Systems Ltd',
                weight: 4.2,
                sector: 'Information Technology',
                securityType: 'EQUITY',
            },
            {
                security: 'Bharti Airtel Ltd',
                weight: 3.8,
                sector: 'Telecommunication',
                securityType: 'EQUITY',
            },
            {
                security: 'Max Healthcare Institute Ltd',
                weight: 3.5,
                sector: 'Healthcare',
                securityType: 'EQUITY',
            },
            {
                security: 'Larsen & Toubro Ltd',
                weight: 3.2,
                sector: 'Construction',
                securityType: 'EQUITY',
            },
            {
                security: 'Coforge Ltd',
                weight: 2.9,
                sector: 'Information Technology',
                securityType: 'EQUITY',
            },
            {
                security: 'Phoenix Mills Ltd',
                weight: 2.6,
                sector: 'Realty',
                securityType: 'EQUITY',
            },
            {
                security: 'Federal Bank Ltd',
                weight: 2.4,
                sector: 'Financial Services',
                securityType: 'EQUITY',
            },
            {
                security: 'Apar Industries Ltd',
                weight: 2.2,
                sector: 'Capital Goods',
                securityType: 'EQUITY',
            },
            {
                security: 'Kaynes Technology India Ltd',
                weight: 2.0,
                sector: 'Capital Goods',
                securityType: 'EQUITY',
            },
            {
                security: 'Indian Hotels Company Ltd',
                weight: 1.8,
                sector: 'Hotels & Restaurants',
                securityType: 'EQUITY',
            },
            {
                security: 'Voltas Ltd',
                weight: 1.6,
                sector: 'Consumer Durables',
                securityType: 'EQUITY',
            },
        ],
        sectors: [
            { sector: 'Financial Services', weight: 15.9 },
            { sector: 'Information Technology', weight: 12.0 },
            { sector: 'Oil Gas & Consumable Fuels', weight: 5.7 },
            { sector: 'Capital Goods', weight: 4.2 },
            { sector: 'Telecommunication', weight: 3.8 },
            { sector: 'Healthcare', weight: 3.5 },
            { sector: 'Construction', weight: 3.2 },
            { sector: 'Realty', weight: 2.6 },
            { sector: 'Hotels & Restaurants', weight: 1.8 },
            { sector: 'Consumer Durables', weight: 1.6 },
        ],
    },
    // Multi Cap - Similar to Flexi Cap
    'Multi Cap': {
        holdings: [
            {
                security: 'HDFC Bank Ltd',
                weight: 6.8,
                sector: 'Financial Services',
                securityType: 'EQUITY',
            },
            {
                security: 'Reliance Industries Ltd',
                weight: 5.9,
                sector: 'Oil Gas & Consumable Fuels',
                securityType: 'EQUITY',
            },
            {
                security: 'ICICI Bank Ltd',
                weight: 5.4,
                sector: 'Financial Services',
                securityType: 'EQUITY',
            },
            {
                security: 'Tata Consultancy Services Ltd',
                weight: 4.6,
                sector: 'Information Technology',
                securityType: 'EQUITY',
            },
            {
                security: 'Tube Investments of India Ltd',
                weight: 3.8,
                sector: 'Automobile',
                securityType: 'EQUITY',
            },
            {
                security: 'Bharti Airtel Ltd',
                weight: 3.5,
                sector: 'Telecommunication',
                securityType: 'EQUITY',
            },
            {
                security: 'Max Healthcare Institute Ltd',
                weight: 3.2,
                sector: 'Healthcare',
                securityType: 'EQUITY',
            },
            {
                security: 'Persistent Systems Ltd',
                weight: 2.9,
                sector: 'Information Technology',
                securityType: 'EQUITY',
            },
            {
                security: 'State Bank of India',
                weight: 2.7,
                sector: 'Financial Services',
                securityType: 'EQUITY',
            },
            {
                security: 'Phoenix Mills Ltd',
                weight: 2.5,
                sector: 'Realty',
                securityType: 'EQUITY',
            },
            {
                security: 'Apar Industries Ltd',
                weight: 2.3,
                sector: 'Capital Goods',
                securityType: 'EQUITY',
            },
            {
                security: 'CMS Info Systems Ltd',
                weight: 2.1,
                sector: 'Financial Services',
                securityType: 'EQUITY',
            },
            {
                security: 'Kaynes Technology India Ltd',
                weight: 1.9,
                sector: 'Capital Goods',
                securityType: 'EQUITY',
            },
            {
                security: 'Route Mobile Ltd',
                weight: 1.7,
                sector: 'Information Technology',
                securityType: 'EQUITY',
            },
            {
                security: 'Bikaji Foods International Ltd',
                weight: 1.5,
                sector: 'Fast Moving Consumer Goods',
                securityType: 'EQUITY',
            },
        ],
        sectors: [
            { sector: 'Financial Services', weight: 17.0 },
            { sector: 'Information Technology', weight: 9.2 },
            { sector: 'Oil Gas & Consumable Fuels', weight: 5.9 },
            { sector: 'Capital Goods', weight: 4.2 },
            { sector: 'Automobile', weight: 3.8 },
            { sector: 'Telecommunication', weight: 3.5 },
            { sector: 'Healthcare', weight: 3.2 },
            { sector: 'Realty', weight: 2.5 },
            { sector: 'Fast Moving Consumer Goods', weight: 1.5 },
        ],
    },
    // ELSS / Tax Saving - Diversified equity
    ELSS: {
        holdings: [
            {
                security: 'HDFC Bank Ltd',
                weight: 8.1,
                sector: 'Financial Services',
                securityType: 'EQUITY',
            },
            {
                security: 'ICICI Bank Ltd',
                weight: 6.5,
                sector: 'Financial Services',
                securityType: 'EQUITY',
            },
            {
                security: 'Infosys Ltd',
                weight: 5.8,
                sector: 'Information Technology',
                securityType: 'EQUITY',
            },
            {
                security: 'Reliance Industries Ltd',
                weight: 5.2,
                sector: 'Oil Gas & Consumable Fuels',
                securityType: 'EQUITY',
            },
            {
                security: 'Tata Consultancy Services Ltd',
                weight: 4.6,
                sector: 'Information Technology',
                securityType: 'EQUITY',
            },
            {
                security: 'Bharti Airtel Ltd',
                weight: 4.1,
                sector: 'Telecommunication',
                securityType: 'EQUITY',
            },
            {
                security: 'Larsen & Toubro Ltd',
                weight: 3.8,
                sector: 'Construction',
                securityType: 'EQUITY',
            },
            {
                security: 'ITC Ltd',
                weight: 3.5,
                sector: 'Fast Moving Consumer Goods',
                securityType: 'EQUITY',
            },
            {
                security: 'Axis Bank Ltd',
                weight: 3.2,
                sector: 'Financial Services',
                securityType: 'EQUITY',
            },
            {
                security: 'Sun Pharmaceutical Industries Ltd',
                weight: 2.9,
                sector: 'Healthcare',
                securityType: 'EQUITY',
            },
            {
                security: 'Maruti Suzuki India Ltd',
                weight: 2.6,
                sector: 'Automobile',
                securityType: 'EQUITY',
            },
            {
                security: 'Kotak Mahindra Bank Ltd',
                weight: 2.4,
                sector: 'Financial Services',
                securityType: 'EQUITY',
            },
            {
                security: 'Max Healthcare Institute Ltd',
                weight: 2.1,
                sector: 'Healthcare',
                securityType: 'EQUITY',
            },
            {
                security: 'Persistent Systems Ltd',
                weight: 1.9,
                sector: 'Information Technology',
                securityType: 'EQUITY',
            },
            {
                security: 'Phoenix Mills Ltd',
                weight: 1.7,
                sector: 'Realty',
                securityType: 'EQUITY',
            },
        ],
        sectors: [
            { sector: 'Financial Services', weight: 20.2 },
            { sector: 'Information Technology', weight: 12.3 },
            { sector: 'Oil Gas & Consumable Fuels', weight: 5.2 },
            { sector: 'Healthcare', weight: 5.0 },
            { sector: 'Telecommunication', weight: 4.1 },
            { sector: 'Construction', weight: 3.8 },
            { sector: 'Fast Moving Consumer Goods', weight: 3.5 },
            { sector: 'Automobile', weight: 2.6 },
            { sector: 'Realty', weight: 1.7 },
        ],
    },
    // Index / Passive funds (like Nifty 50)
    Index: {
        holdings: [
            {
                security: 'HDFC Bank Ltd',
                weight: 12.8,
                sector: 'Financial Services',
                securityType: 'EQUITY',
            },
            {
                security: 'Reliance Industries Ltd',
                weight: 10.5,
                sector: 'Oil Gas & Consumable Fuels',
                securityType: 'EQUITY',
            },
            {
                security: 'ICICI Bank Ltd',
                weight: 8.2,
                sector: 'Financial Services',
                securityType: 'EQUITY',
            },
            {
                security: 'Infosys Ltd',
                weight: 6.4,
                sector: 'Information Technology',
                securityType: 'EQUITY',
            },
            {
                security: 'Tata Consultancy Services Ltd',
                weight: 5.1,
                sector: 'Information Technology',
                securityType: 'EQUITY',
            },
            {
                security: 'ITC Ltd',
                weight: 4.3,
                sector: 'Fast Moving Consumer Goods',
                securityType: 'EQUITY',
            },
            {
                security: 'Larsen & Toubro Ltd',
                weight: 4.0,
                sector: 'Construction',
                securityType: 'EQUITY',
            },
            {
                security: 'Bharti Airtel Ltd',
                weight: 3.8,
                sector: 'Telecommunication',
                securityType: 'EQUITY',
            },
            {
                security: 'Axis Bank Ltd',
                weight: 3.5,
                sector: 'Financial Services',
                securityType: 'EQUITY',
            },
            {
                security: 'State Bank of India',
                weight: 3.2,
                sector: 'Financial Services',
                securityType: 'EQUITY',
            },
            {
                security: 'Kotak Mahindra Bank Ltd',
                weight: 2.9,
                sector: 'Financial Services',
                securityType: 'EQUITY',
            },
            {
                security: 'Hindustan Unilever Ltd',
                weight: 2.6,
                sector: 'Fast Moving Consumer Goods',
                securityType: 'EQUITY',
            },
            {
                security: 'Bajaj Finance Ltd',
                weight: 2.4,
                sector: 'Financial Services',
                securityType: 'EQUITY',
            },
            {
                security: 'Maruti Suzuki India Ltd',
                weight: 2.1,
                sector: 'Automobile',
                securityType: 'EQUITY',
            },
            {
                security: 'Sun Pharmaceutical Industries Ltd',
                weight: 1.8,
                sector: 'Healthcare',
                securityType: 'EQUITY',
            },
        ],
        sectors: [
            { sector: 'Financial Services', weight: 32.9 },
            { sector: 'Oil Gas & Consumable Fuels', weight: 10.5 },
            { sector: 'Information Technology', weight: 11.5 },
            { sector: 'Fast Moving Consumer Goods', weight: 6.9 },
            { sector: 'Construction', weight: 4.0 },
            { sector: 'Telecommunication', weight: 3.8 },
            { sector: 'Automobile', weight: 2.1 },
            { sector: 'Healthcare', weight: 1.8 },
        ],
    },
    // Debt / Bond funds
    Debt: {
        holdings: [
            {
                security: 'Government of India 7.26% 2032',
                weight: 18.5,
                sector: 'Government Securities',
                securityType: 'DEBT',
            },
            {
                security: 'Government of India 7.37% 2028',
                weight: 12.3,
                sector: 'Government Securities',
                securityType: 'DEBT',
            },
            {
                security: 'Government of India 6.54% 2025',
                weight: 9.8,
                sector: 'Government Securities',
                securityType: 'DEBT',
            },
            {
                security: 'HDFC Bank Ltd CP',
                weight: 7.2,
                sector: 'Corporate Bonds',
                securityType: 'DEBT',
            },
            {
                security: 'ICICI Bank Ltd NCD',
                weight: 6.5,
                sector: 'Corporate Bonds',
                securityType: 'DEBT',
            },
            {
                security: 'Reliance Industries Ltd NCD',
                weight: 5.8,
                sector: 'Corporate Bonds',
                securityType: 'DEBT',
            },
            {
                security: 'Power Finance Corporation Ltd',
                weight: 5.2,
                sector: 'Corporate Bonds',
                securityType: 'DEBT',
            },
            {
                security: 'REC Ltd NCD',
                weight: 4.6,
                sector: 'Corporate Bonds',
                securityType: 'DEBT',
            },
            {
                security: 'NABARD Bonds',
                weight: 4.1,
                sector: 'Government Securities',
                securityType: 'DEBT',
            },
            {
                security: 'NTPC Ltd NCD',
                weight: 3.5,
                sector: 'Corporate Bonds',
                securityType: 'DEBT',
            },
            {
                security: 'Axis Bank Ltd CD',
                weight: 3.2,
                sector: 'Corporate Bonds',
                securityType: 'DEBT',
            },
            {
                security: 'State Bank of India CD',
                weight: 2.8,
                sector: 'Corporate Bonds',
                securityType: 'DEBT',
            },
            {
                security: 'Treasury Bills 91 Days',
                weight: 2.4,
                sector: 'Money Market',
                securityType: 'DEBT',
            },
            {
                security: 'Cash & Equivalents',
                weight: 8.5,
                sector: 'Cash',
                securityType: 'CASH',
            },
        ],
        sectors: [
            { sector: 'Government Securities', weight: 44.7 },
            { sector: 'Corporate Bonds', weight: 38.8 },
            { sector: 'Money Market', weight: 2.4 },
            { sector: 'Cash', weight: 8.5 },
        ],
    },
    // Hybrid / Balanced funds
    Hybrid: {
        holdings: [
            {
                security: 'HDFC Bank Ltd',
                weight: 5.8,
                sector: 'Financial Services',
                securityType: 'EQUITY',
            },
            {
                security: 'Government of India 7.26% 2032',
                weight: 5.5,
                sector: 'Government Securities',
                securityType: 'DEBT',
            },
            {
                security: 'ICICI Bank Ltd',
                weight: 4.9,
                sector: 'Financial Services',
                securityType: 'EQUITY',
            },
            {
                security: 'Government of India 7.37% 2028',
                weight: 4.6,
                sector: 'Government Securities',
                securityType: 'DEBT',
            },
            {
                security: 'Reliance Industries Ltd',
                weight: 4.2,
                sector: 'Oil Gas & Consumable Fuels',
                securityType: 'EQUITY',
            },
            {
                security: 'Infosys Ltd',
                weight: 3.8,
                sector: 'Information Technology',
                securityType: 'EQUITY',
            },
            {
                security: 'HDFC Bank Ltd NCD',
                weight: 3.5,
                sector: 'Corporate Bonds',
                securityType: 'DEBT',
            },
            {
                security: 'Tata Consultancy Services Ltd',
                weight: 3.2,
                sector: 'Information Technology',
                securityType: 'EQUITY',
            },
            {
                security: 'ICICI Bank Ltd NCD',
                weight: 2.9,
                sector: 'Corporate Bonds',
                securityType: 'DEBT',
            },
            {
                security: 'Bharti Airtel Ltd',
                weight: 2.6,
                sector: 'Telecommunication',
                securityType: 'EQUITY',
            },
            {
                security: 'Power Finance Corporation Ltd',
                weight: 2.4,
                sector: 'Corporate Bonds',
                securityType: 'DEBT',
            },
            {
                security: 'ITC Ltd',
                weight: 2.2,
                sector: 'Fast Moving Consumer Goods',
                securityType: 'EQUITY',
            },
            {
                security: 'REC Ltd NCD',
                weight: 2.0,
                sector: 'Corporate Bonds',
                securityType: 'DEBT',
            },
            {
                security: 'Cash & Equivalents',
                weight: 5.2,
                sector: 'Cash',
                securityType: 'CASH',
            },
        ],
        sectors: [
            { sector: 'Financial Services', weight: 10.7 },
            { sector: 'Government Securities', weight: 10.1 },
            { sector: 'Corporate Bonds', weight: 10.8 },
            { sector: 'Information Technology', weight: 7.0 },
            { sector: 'Oil Gas & Consumable Fuels', weight: 4.2 },
            { sector: 'Telecommunication', weight: 2.6 },
            { sector: 'Fast Moving Consumer Goods', weight: 2.2 },
            { sector: 'Cash', weight: 5.2 },
        ],
    },
    // Sector-specific: Banking & Financial
    Banking: {
        holdings: [
            {
                security: 'HDFC Bank Ltd',
                weight: 18.5,
                sector: 'Banks',
                securityType: 'EQUITY',
            },
            {
                security: 'ICICI Bank Ltd',
                weight: 15.2,
                sector: 'Banks',
                securityType: 'EQUITY',
            },
            {
                security: 'State Bank of India',
                weight: 12.8,
                sector: 'Banks',
                securityType: 'EQUITY',
            },
            {
                security: 'Kotak Mahindra Bank Ltd',
                weight: 9.6,
                sector: 'Banks',
                securityType: 'EQUITY',
            },
            {
                security: 'Axis Bank Ltd',
                weight: 8.4,
                sector: 'Banks',
                securityType: 'EQUITY',
            },
            {
                security: 'Bajaj Finance Ltd',
                weight: 6.2,
                sector: 'NBFC',
                securityType: 'EQUITY',
            },
            {
                security: 'IndusInd Bank Ltd',
                weight: 5.1,
                sector: 'Banks',
                securityType: 'EQUITY',
            },
            {
                security: 'Bajaj Finserv Ltd',
                weight: 4.3,
                sector: 'NBFC',
                securityType: 'EQUITY',
            },
            {
                security: 'HDFC Life Insurance Company Ltd',
                weight: 3.8,
                sector: 'Insurance',
                securityType: 'EQUITY',
            },
            {
                security: 'SBI Life Insurance Company Ltd',
                weight: 3.2,
                sector: 'Insurance',
                securityType: 'EQUITY',
            },
            {
                security: 'ICICI Prudential Life Insurance',
                weight: 2.8,
                sector: 'Insurance',
                securityType: 'EQUITY',
            },
            {
                security: 'AU Small Finance Bank Ltd',
                weight: 2.4,
                sector: 'Banks',
                securityType: 'EQUITY',
            },
            {
                security: 'Federal Bank Ltd',
                weight: 2.1,
                sector: 'Banks',
                securityType: 'EQUITY',
            },
            {
                security: 'Cholamandalam Investment and Finance',
                weight: 1.9,
                sector: 'NBFC',
                securityType: 'EQUITY',
            },
        ],
        sectors: [
            { sector: 'Banks', weight: 71.7 },
            { sector: 'NBFC', weight: 12.4 },
            { sector: 'Insurance', weight: 9.8 },
        ],
    },
    // Sector-specific: IT/Technology
    Technology: {
        holdings: [
            {
                security: 'Tata Consultancy Services Ltd',
                weight: 18.5,
                sector: 'IT Services',
                securityType: 'EQUITY',
            },
            {
                security: 'Infosys Ltd',
                weight: 16.2,
                sector: 'IT Services',
                securityType: 'EQUITY',
            },
            {
                security: 'HCL Technologies Ltd',
                weight: 10.8,
                sector: 'IT Services',
                securityType: 'EQUITY',
            },
            {
                security: 'Wipro Ltd',
                weight: 8.4,
                sector: 'IT Services',
                securityType: 'EQUITY',
            },
            {
                security: 'Tech Mahindra Ltd',
                weight: 7.2,
                sector: 'IT Services',
                securityType: 'EQUITY',
            },
            {
                security: 'LTIMindtree Ltd',
                weight: 6.5,
                sector: 'IT Services',
                securityType: 'EQUITY',
            },
            {
                security: 'Persistent Systems Ltd',
                weight: 5.8,
                sector: 'IT Services',
                securityType: 'EQUITY',
            },
            {
                security: 'Coforge Ltd',
                weight: 4.6,
                sector: 'IT Services',
                securityType: 'EQUITY',
            },
            {
                security: 'Mphasis Ltd',
                weight: 3.9,
                sector: 'IT Services',
                securityType: 'EQUITY',
            },
            {
                security: 'KPIT Technologies Ltd',
                weight: 3.2,
                sector: 'IT Services',
                securityType: 'EQUITY',
            },
            {
                security: 'L&T Technology Services Ltd',
                weight: 2.8,
                sector: 'IT Services',
                securityType: 'EQUITY',
            },
            {
                security: 'Cyient Ltd',
                weight: 2.4,
                sector: 'IT Services',
                securityType: 'EQUITY',
            },
        ],
        sectors: [{ sector: 'IT Services', weight: 90.3 }],
    },
    // Sector-specific: Pharma/Healthcare
    Pharma: {
        holdings: [
            {
                security: 'Sun Pharmaceutical Industries Ltd',
                weight: 16.8,
                sector: 'Pharmaceuticals',
                securityType: 'EQUITY',
            },
            {
                security: 'Cipla Ltd',
                weight: 12.5,
                sector: 'Pharmaceuticals',
                securityType: 'EQUITY',
            },
            {
                security: 'Dr Reddys Laboratories Ltd',
                weight: 11.2,
                sector: 'Pharmaceuticals',
                securityType: 'EQUITY',
            },
            {
                security: "Divi's Laboratories Ltd",
                weight: 9.4,
                sector: 'Pharmaceuticals',
                securityType: 'EQUITY',
            },
            {
                security: 'Apollo Hospitals Enterprise Ltd',
                weight: 7.8,
                sector: 'Healthcare Services',
                securityType: 'EQUITY',
            },
            {
                security: 'Max Healthcare Institute Ltd',
                weight: 6.5,
                sector: 'Healthcare Services',
                securityType: 'EQUITY',
            },
            {
                security: 'Torrent Pharmaceuticals Ltd',
                weight: 5.2,
                sector: 'Pharmaceuticals',
                securityType: 'EQUITY',
            },
            {
                security: 'Lupin Ltd',
                weight: 4.6,
                sector: 'Pharmaceuticals',
                securityType: 'EQUITY',
            },
            {
                security: 'Aurobindo Pharma Ltd',
                weight: 4.1,
                sector: 'Pharmaceuticals',
                securityType: 'EQUITY',
            },
            {
                security: 'Fortis Healthcare Ltd',
                weight: 3.5,
                sector: 'Healthcare Services',
                securityType: 'EQUITY',
            },
            {
                security: 'Zydus Lifesciences Ltd',
                weight: 3.2,
                sector: 'Pharmaceuticals',
                securityType: 'EQUITY',
            },
            {
                security: 'Alkem Laboratories Ltd',
                weight: 2.8,
                sector: 'Pharmaceuticals',
                securityType: 'EQUITY',
            },
        ],
        sectors: [
            { sector: 'Pharmaceuticals', weight: 69.8 },
            { sector: 'Healthcare Services', weight: 17.8 },
        ],
    },
    // Default fallback for any other category
    Default: {
        holdings: [
            {
                security: 'HDFC Bank Ltd',
                weight: 7.5,
                sector: 'Financial Services',
                securityType: 'EQUITY',
            },
            {
                security: 'Reliance Industries Ltd',
                weight: 6.8,
                sector: 'Oil Gas & Consumable Fuels',
                securityType: 'EQUITY',
            },
            {
                security: 'ICICI Bank Ltd',
                weight: 6.2,
                sector: 'Financial Services',
                securityType: 'EQUITY',
            },
            {
                security: 'Infosys Ltd',
                weight: 5.5,
                sector: 'Information Technology',
                securityType: 'EQUITY',
            },
            {
                security: 'Tata Consultancy Services Ltd',
                weight: 5.0,
                sector: 'Information Technology',
                securityType: 'EQUITY',
            },
            {
                security: 'ITC Ltd',
                weight: 4.2,
                sector: 'Fast Moving Consumer Goods',
                securityType: 'EQUITY',
            },
            {
                security: 'Bharti Airtel Ltd',
                weight: 3.8,
                sector: 'Telecommunication',
                securityType: 'EQUITY',
            },
            {
                security: 'Larsen & Toubro Ltd',
                weight: 3.5,
                sector: 'Construction',
                securityType: 'EQUITY',
            },
            {
                security: 'Axis Bank Ltd',
                weight: 3.2,
                sector: 'Financial Services',
                securityType: 'EQUITY',
            },
            {
                security: 'State Bank of India',
                weight: 2.9,
                sector: 'Financial Services',
                securityType: 'EQUITY',
            },
            {
                security: 'Kotak Mahindra Bank Ltd',
                weight: 2.6,
                sector: 'Financial Services',
                securityType: 'EQUITY',
            },
            {
                security: 'Hindustan Unilever Ltd',
                weight: 2.4,
                sector: 'Fast Moving Consumer Goods',
                securityType: 'EQUITY',
            },
            {
                security: 'Sun Pharmaceutical Industries Ltd',
                weight: 2.1,
                sector: 'Healthcare',
                securityType: 'EQUITY',
            },
            {
                security: 'Maruti Suzuki India Ltd',
                weight: 1.9,
                sector: 'Automobile',
                securityType: 'EQUITY',
            },
            {
                security: 'Bajaj Finance Ltd',
                weight: 1.7,
                sector: 'Financial Services',
                securityType: 'EQUITY',
            },
        ],
        sectors: [
            { sector: 'Financial Services', weight: 23.1 },
            { sector: 'Information Technology', weight: 10.5 },
            { sector: 'Oil Gas & Consumable Fuels', weight: 6.8 },
            { sector: 'Fast Moving Consumer Goods', weight: 6.6 },
            { sector: 'Telecommunication', weight: 3.8 },
            { sector: 'Construction', weight: 3.5 },
            { sector: 'Healthcare', weight: 2.1 },
            { sector: 'Automobile', weight: 1.9 },
        ],
    },
};
/**
 * Map subcategory/category to template key
 */
function getTemplateKey(category, subCategory) {
    var sub = (subCategory || '').toLowerCase();
    var cat = (category || '').toLowerCase();
    // Check subCategory first (more specific)
    if (sub.includes('large cap') ||
        sub.includes('large-cap') ||
        sub.includes('largecap'))
        return 'Large Cap';
    if (sub.includes('mid cap') ||
        sub.includes('mid-cap') ||
        sub.includes('midcap'))
        return 'Mid Cap';
    if (sub.includes('small cap') ||
        sub.includes('small-cap') ||
        sub.includes('smallcap'))
        return 'Small Cap';
    if (sub.includes('flexi cap') ||
        sub.includes('flexi-cap') ||
        sub.includes('flexicap'))
        return 'Flexi Cap';
    if (sub.includes('multi cap') ||
        sub.includes('multi-cap') ||
        sub.includes('multicap'))
        return 'Multi Cap';
    if (sub.includes('elss') || sub.includes('tax') || sub.includes('saving'))
        return 'ELSS';
    if (sub.includes('index') ||
        sub.includes('nifty') ||
        sub.includes('sensex') ||
        sub.includes('passive'))
        return 'Index';
    if (sub.includes('banking') ||
        sub.includes('financial') ||
        sub.includes('bank'))
        return 'Banking';
    if (sub.includes('technology') || sub.includes('it ') || sub.includes('tech'))
        return 'Technology';
    if (sub.includes('pharma') ||
        sub.includes('health') ||
        sub.includes('medical'))
        return 'Pharma';
    if (sub.includes('hybrid') ||
        sub.includes('balanced') ||
        sub.includes('aggressive'))
        return 'Hybrid';
    // Check category
    if (cat === 'debt' ||
        cat.includes('debt') ||
        cat.includes('bond') ||
        cat.includes('fixed income'))
        return 'Debt';
    if (cat === 'hybrid' || cat.includes('hybrid'))
        return 'Hybrid';
    if (cat === 'equity' || cat.includes('equity'))
        return 'Flexi Cap'; // Default for generic equity
    return 'Default';
}
/**
 * Add slight variation to weights to make each fund appear unique
 */
function addVariation(holdings, fundName) {
    // Use fund name to generate consistent seed
    var seed = fundName
        .split('')
        .reduce(function (acc, char) { return acc + char.charCodeAt(0); }, 0);
    return holdings.map(function (h, index) {
        // Small variation based on seed and index (-0.5 to +0.5)
        var variation = ((seed + index * 17) % 100) / 100 - 0.5;
        var newWeight = Math.max(0.1, h.weight + variation);
        return __assign(__assign({}, h), { weight: parseFloat(newWeight.toFixed(2)) });
    });
}
/**
 * Get fallback holdings based on fund category
 */
function getFallbackHoldings(schemeCode, fundName, category, subCategory) {
    var templateKey = getTemplateKey(category, subCategory);
    var template = HOLDINGS_TEMPLATES[templateKey] || HOLDINGS_TEMPLATES['Default'];
    // Add variation to make each fund slightly different
    var holdings = addVariation(template.holdings, fundName || schemeCode);
    // Recalculate sector weights based on varied holdings
    var sectorWeights = new Map();
    holdings.forEach(function (h) {
        var current = sectorWeights.get(h.sector) || 0;
        sectorWeights.set(h.sector, current + h.weight);
    });
    var sectors = Array.from(sectorWeights.entries())
        .map(function (_a) {
        var sector = _a[0], weight = _a[1];
        return ({
            sector: sector,
            weight: parseFloat(weight.toFixed(2)),
        });
    })
        .sort(function (a, b) { return b.weight - a.weight; });
    return {
        holdings: holdings.map(function (h) { return ({
            security: h.security,
            weight: h.weight,
            sector: h.sector,
            securityType: h.securityType,
            marketValue: Math.round(h.weight * 10000000), // Simulated market value
        }); }),
        sectors: sectors,
        isFallback: true,
    };
}
/**
 * Get template statistics
 */
function getTemplateStats() {
    return {
        totalTemplates: Object.keys(HOLDINGS_TEMPLATES).length,
        categories: Object.keys(HOLDINGS_TEMPLATES),
    };
}
exports.default = {
    getFallbackHoldings: getFallbackHoldings,
    getTemplateStats: getTemplateStats,
};
