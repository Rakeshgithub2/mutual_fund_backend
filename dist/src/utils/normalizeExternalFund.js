"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeExternalFund = normalizeExternalFund;
exports.normalizeExternalHoldings = normalizeExternalHoldings;
// Utility to normalize external fund API responses (MFAPI, AMFI, etc.) to internal schema
function normalizeExternalFund(mfapiData) {
    if (!mfapiData || !mfapiData.meta)
        return null;
    return {
        fundId: mfapiData.meta.scheme_code ||
            mfapiData.meta.schemeCode ||
            mfapiData.meta.scheme_id,
        name: mfapiData.meta.scheme_name,
        fundHouse: mfapiData.meta.fund_house,
        category: mfapiData.meta.scheme_category,
        subCategory: mfapiData.meta.scheme_type,
        currentNav: parseFloat(mfapiData.data?.[0]?.nav || '0'),
        navDate: mfapiData.data?.[0]?.date
            ? new Date(mfapiData.data[0].date)
            : null,
        lastUpdated: new Date(),
        // Add more fields as needed for your schema
    };
}
// Utility to normalize external holdings API responses to internal schema
function normalizeExternalHoldings(mfapiData, schemeCode) {
    const holdings = (mfapiData.data?.[0]?.holdings || []).map((h) => ({
        company: h.company || h.name || '',
        sector: h.sector || '',
        percentage: parseFloat(h.percentage || '0'),
    }));
    return {
        schemeCode,
        holdings,
        fetchedAt: new Date(),
    };
}
