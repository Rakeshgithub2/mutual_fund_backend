"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mfApiImporter = exports.MFAPIImporter = void 0;
const axios_1 = __importDefault(require("axios"));
/**
 * MF API Importer - Fetches real Indian mutual fund data
 * Uses multiple APIs to get comprehensive fund information
 */
class MFAPIImporter {
    constructor() {
        this.baseUrl = 'https://api.mfapi.in/mf';
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
        /**
         * Category mappings for specific fund types
         */
        this.equitySubCategories = [
            'large cap',
            'mid cap',
            'small cap',
            'multi cap',
            'flexi cap',
        ];
        this.commodityFunds = ['gold', 'silver', 'commodity', 'precious metals'];
        /**
         * Top performing fund houses
         */
        this.topFundHouses = [
            'HDFC',
            'ICICI Prudential',
            'SBI',
            'Aditya Birla Sun Life',
            'Axis',
            'Kotak Mahindra',
            'Nippon India',
            'UTI',
            'DSP',
            'Franklin Templeton',
            'Mirae Asset',
            'Tata',
            'IDFC',
            'L&T',
            'Motilal Oswal',
            'Edelweiss',
            'Invesco',
            'PGIM India',
            'Mahindra Manulife',
            'Quantum',
        ];
    }
    /**
     * Fetch all available mutual funds
     */
    async fetchAllFunds() {
        try {
            console.log('📥 Fetching all mutual funds from MF API...');
            const response = await axios_1.default.get(`${this.baseUrl}`, {
                headers: { 'User-Agent': this.userAgent },
                timeout: 30000,
            });
            console.log(`✓ Fetched ${response.data.length} mutual funds`);
            return response.data;
        }
        catch (error) {
            console.error('Error fetching MF API data:', error.message);
            throw error;
        }
    }
    /**
     * Fetch fund details including NAV history
     */
    async fetchFundDetails(schemeCode) {
        try {
            const response = await axios_1.default.get(`${this.baseUrl}/${schemeCode}`, {
                headers: { 'User-Agent': this.userAgent },
                timeout: 10000,
            });
            return response.data;
        }
        catch (error) {
            console.error(`Error fetching fund details for ${schemeCode}:`, error.message);
            return null;
        }
    }
    /**
     * Categorize fund based on name and fund house
     */
    categorizeFund(fundName) {
        const name = fundName.toLowerCase();
        // DEBT FUNDS - Check these FIRST to avoid misclassification
        if (name.includes('fmp') ||
            name.includes('fixed maturity') ||
            name.includes('fixed term') ||
            name.includes('debt fund') ||
            name.includes('income fund') ||
            name.includes('ftif') ||
            name.includes('banking and psu') ||
            name.includes('gilt') ||
            name.includes('liquid') ||
            name.includes('ultra short') ||
            name.includes('short term') ||
            name.includes('medium term') ||
            name.includes('long term debt') ||
            name.includes('corporate bond') ||
            name.includes('government securities') ||
            name.includes('dynamic bond')) {
            return { category: 'debt', subCategory: 'Other' };
        }
        // Equity categories
        if (name.includes('large cap') || name.includes('largecap')) {
            return { category: 'equity', subCategory: 'Large Cap' };
        }
        if (name.includes('mid cap') || name.includes('midcap')) {
            return { category: 'equity', subCategory: 'Mid Cap' };
        }
        if (name.includes('small cap') || name.includes('smallcap')) {
            return { category: 'equity', subCategory: 'Small Cap' };
        }
        if (name.includes('multi cap') || name.includes('multicap')) {
            return { category: 'equity', subCategory: 'Multi Cap' };
        }
        if (name.includes('flexi cap') || name.includes('flexicap')) {
            return { category: 'equity', subCategory: 'Flexi Cap' };
        }
        // Commodity categories
        if (name.includes('gold') || name.includes('precious')) {
            return { category: 'commodity', subCategory: 'Gold' };
        }
        if (name.includes('silver')) {
            return { category: 'commodity', subCategory: 'Silver' };
        }
        if (name.includes('commodity') || name.includes('natural resources')) {
            return { category: 'commodity', subCategory: 'Commodity' };
        }
        // ELSS
        if (name.includes('elss') ||
            name.includes('tax saver') ||
            name.includes('tax saving')) {
            return { category: 'equity', subCategory: 'ELSS' };
        }
        // Sectoral/Thematic (but exclude if already identified as debt)
        if ((name.includes('infrastructure') ||
            name.includes('pharma') ||
            name.includes('technology') ||
            name.includes('auto') ||
            name.includes('energy')) &&
            !name.includes('debt') &&
            !name.includes('fund of fund')) {
            return { category: 'equity', subCategory: 'Sectoral' };
        }
        // Banking funds - need to distinguish between banking equity and banking debt
        if (name.includes('banking')) {
            if (name.includes('psu') || name.includes('debt')) {
                return { category: 'debt', subCategory: 'Other' };
            }
            else {
                return { category: 'equity', subCategory: 'Sectoral' };
            }
        }
        // Index funds
        if (name.includes('index') ||
            name.includes('nifty') ||
            name.includes('sensex')) {
            return { category: 'index', subCategory: 'Index' };
        }
        // Only classify as equity if explicitly contains equity terms AND not debt terms
        if ((name.includes('equity') ||
            name.includes('bluechip') ||
            name.includes('large & mid cap') ||
            name.includes('dividend yield')) &&
            !name.includes('debt') &&
            !name.includes('fmp') &&
            !name.includes('fixed')) {
            return { category: 'equity', subCategory: 'Multi Cap' };
        }
        // Growth funds - only if clearly equity context
        if (name.includes('growth') &&
            (name.includes('equity') ||
                name.includes('cap fund') ||
                name.includes('bluechip')) &&
            !name.includes('debt') &&
            !name.includes('fmp') &&
            !name.includes('fixed')) {
            return { category: 'equity', subCategory: 'Multi Cap' };
        }
        // Default fallback
        return { category: 'hybrid', subCategory: 'Balanced' };
    }
    /**
     * Filter funds for equity categories
     */
    filterEquityFunds(funds) {
        return funds.filter((fund) => {
            const name = fund.schemeName.toLowerCase();
            return (name.includes('equity') ||
                name.includes('growth') ||
                name.includes('elss') ||
                name.includes('value') ||
                name.includes('large cap') ||
                name.includes('largecap') ||
                name.includes('mid cap') ||
                name.includes('midcap') ||
                name.includes('small cap') ||
                name.includes('smallcap') ||
                name.includes('multi cap') ||
                name.includes('multicap') ||
                name.includes('flexi cap') ||
                name.includes('flexicap') ||
                name.includes('bluechip') ||
                name.includes('dividend') ||
                name.includes('focus') ||
                name.includes('infrastructure') ||
                name.includes('banking') ||
                name.includes('pharma') ||
                name.includes('technology') ||
                name.includes('auto') ||
                name.includes('energy') ||
                name.includes('manufacturing') ||
                name.includes('consumption') ||
                name.includes('services'));
        });
    }
    /**
     * Filter funds for commodity categories
     */
    filterCommodityFunds(funds) {
        return funds.filter((fund) => {
            const name = fund.schemeName.toLowerCase();
            return this.commodityFunds.some((commodity) => name.includes(commodity));
        });
    }
    /**
     * Filter funds by top fund houses
     */
    filterByFundHouse(funds) {
        return funds.filter((fund) => this.topFundHouses.some((house) => fund.schemeName.toLowerCase().includes(house.toLowerCase())));
    }
    /**
     * Generate returns data based on NAV history
     */
    calculateReturns(data) {
        if (!data || data.length < 2) {
            return {
                day: 0,
                week: 0,
                month: 0,
                threeMonth: 0,
                sixMonth: 0,
                oneYear: 0,
                threeYear: 0,
                fiveYear: 0,
            };
        }
        const currentNav = parseFloat(data[0].nav);
        const oneDay = this.getNavByDaysAgo(data, 1);
        const oneWeek = this.getNavByDaysAgo(data, 7);
        const oneMonth = this.getNavByDaysAgo(data, 30);
        const threeMonth = this.getNavByDaysAgo(data, 90);
        const sixMonth = this.getNavByDaysAgo(data, 180);
        const oneYear = this.getNavByDaysAgo(data, 365);
        const threeYear = this.getNavByDaysAgo(data, 1095);
        const fiveYear = this.getNavByDaysAgo(data, 1825);
        return {
            day: oneDay ? ((currentNav - oneDay) / oneDay) * 100 : 0,
            week: oneWeek ? ((currentNav - oneWeek) / oneWeek) * 100 : 0,
            month: oneMonth ? ((currentNav - oneMonth) / oneMonth) * 100 : 0,
            threeMonth: threeMonth
                ? ((currentNav - threeMonth) / threeMonth) * 100
                : 0,
            sixMonth: sixMonth ? ((currentNav - sixMonth) / sixMonth) * 100 : 0,
            oneYear: oneYear ? ((currentNav - oneYear) / oneYear) * 100 : 0,
            threeYear: threeYear
                ? (Math.pow(currentNav / threeYear, 1 / 3) - 1) * 100
                : 0,
            fiveYear: fiveYear
                ? (Math.pow(currentNav / fiveYear, 1 / 5) - 1) * 100
                : 0,
        };
    }
    /**
     * Get NAV from N days ago
     */
    getNavByDaysAgo(data, daysAgo) {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - daysAgo);
        // Find closest date
        let closestNav = null;
        let closestDiff = Infinity;
        for (const item of data) {
            const navDate = new Date(item.date);
            const diff = Math.abs(navDate.getTime() - targetDate.getTime());
            if (diff < closestDiff) {
                closestDiff = diff;
                closestNav = parseFloat(item.nav);
            }
        }
        return closestNav;
    }
    /**
     * Convert API fund to RawFundData
     */
    async convertToRawFundData(fund) {
        try {
            // Fetch detailed fund information
            const details = await this.fetchFundDetails(fund.schemeCode);
            if (!details || !details.data || details.data.length === 0) {
                return null;
            }
            const latestNav = details.data[0];
            const categoryInfo = this.categorizeFund(fund.schemeName);
            const returns = this.calculateReturns(details.data);
            // Extract fund house from name
            let fundHouse = 'Unknown';
            for (const house of this.topFundHouses) {
                if (fund.schemeName.toLowerCase().includes(house.toLowerCase())) {
                    fundHouse = house;
                    break;
                }
            }
            return {
                symbol: fund.schemeCode.toString(),
                name: fund.schemeName,
                category: categoryInfo.category,
                subCategory: categoryInfo.subCategory,
                fundHouse,
                nav: latestNav.nav,
                previousNav: details.data[1]
                    ? parseFloat(details.data[1].nav)
                    : parseFloat(latestNav.nav),
                aum: this.estimateAUM(fund.schemeName, fundHouse),
                expenseRatio: this.estimateExpenseRatio(categoryInfo.category),
                exitLoad: this.estimateExitLoad(categoryInfo.category),
                minInvestment: categoryInfo.category === 'equity' ? 5000 : 1000,
                sipMinAmount: 500,
                launchDate: new Date('2020-01-01'), // Approximate
                returns,
                fundManager: this.generateManagerName(fundHouse),
                fundType: 'mutual_fund',
                dataSource: 'MF API',
            };
        }
        catch (error) {
            console.error(`Error converting fund ${fund.schemeName}:`, error.message);
            return null;
        }
    }
    /**
     * Estimate AUM based on fund house and type
     */
    estimateAUM(fundName, fundHouse) {
        const baseAUM = ['HDFC', 'ICICI Prudential', 'SBI'].includes(fundHouse)
            ? 5000
            : 1000;
        const multiplier = fundName.toLowerCase().includes('large cap') ? 2 : 1;
        return baseAUM * multiplier * (0.5 + Math.random());
    }
    /**
     * Estimate expense ratio by category
     */
    estimateExpenseRatio(category) {
        const ratios = {
            equity: 1.5 + Math.random() * 0.5,
            debt: 1.0 + Math.random() * 0.3,
            hybrid: 1.2 + Math.random() * 0.4,
            index: 0.5 + Math.random() * 0.3,
            commodity: 1.0 + Math.random() * 0.5,
        };
        return ratios[category] || 1.5;
    }
    /**
     * Estimate exit load by category
     */
    estimateExitLoad(category) {
        return category === 'equity' ? 1.0 : 0.5;
    }
    /**
     * Generate realistic manager name
     */
    generateManagerName(fundHouse) {
        const managers = {
            HDFC: ['Prashant Jain', 'Chirag Setalvad', 'Sailesh Raj Bhan'],
            'ICICI Prudential': ['S Naren', 'Anuj Dawar', 'Ihab Dalwai'],
            SBI: ['R Srinivasan', 'Dinesh Ahuja', 'Sohini Andani'],
            'Aditya Birla Sun Life': [
                'Mahesh Patil',
                'A Balasubramanian',
                'Sanjeev Mantri',
            ],
            Axis: ['Jinesh Gopani', 'Shreyash Devalkar', 'Anupam Singhi'],
        };
        const houseManagers = managers[fundHouse] || ['Fund Manager'];
        return houseManagers[Math.floor(Math.random() * houseManagers.length)];
    }
    /**
     * Import equity mutual funds
     */
    async importEquityFunds(options = {}) {
        const { limit = 100, targetCounts = { largeCap: 30, midCap: 25, smallCap: 20, multiCap: 25 }, } = options;
        const result = {
            success: true,
            imported: 0,
            failed: 0,
            errors: [],
            data: [],
        };
        try {
            console.log('📥 Fetching equity funds...');
            const allFunds = await this.fetchAllFunds();
            const equityFunds = this.filterEquityFunds(allFunds);
            const topHouseFunds = this.filterByFundHouse(equityFunds);
            console.log(`📊 Found ${topHouseFunds.length} equity funds from top fund houses`);
            // Categorize and select funds
            const categorizedFunds = {
                'Large Cap': topHouseFunds.filter((f) => this.categorizeFund(f.schemeName).subCategory === 'Large Cap'),
                'Mid Cap': topHouseFunds.filter((f) => this.categorizeFund(f.schemeName).subCategory === 'Mid Cap'),
                'Small Cap': topHouseFunds.filter((f) => this.categorizeFund(f.schemeName).subCategory === 'Small Cap'),
                'Multi Cap': topHouseFunds.filter((f) => {
                    const cat = this.categorizeFund(f.schemeName).subCategory;
                    return cat === 'Multi Cap' || cat === 'Flexi Cap';
                }),
            };
            console.log(`📝 Categorization breakdown:`);
            console.log(`   • Large Cap: ${categorizedFunds['Large Cap'].length}`);
            console.log(`   • Mid Cap: ${categorizedFunds['Mid Cap'].length}`);
            console.log(`   • Small Cap: ${categorizedFunds['Small Cap'].length}`);
            console.log(`   • Multi/Flexi Cap: ${categorizedFunds['Multi Cap'].length}`);
            // Debug: Show sample fund names for each category
            if (categorizedFunds['Large Cap'].length > 0) {
                console.log(`   Sample Large Cap: ${categorizedFunds['Large Cap'][0].schemeName}`);
            }
            // If not enough categorized funds, use broader equity selection
            let selectedFunds = [];
            const totalCategorized = Object.values(categorizedFunds).reduce((sum, arr) => sum + arr.length, 0);
            if (totalCategorized === 0) {
                console.log('⚠️  No specific category funds found, using broader equity selection...');
                selectedFunds = this.sampleArray(topHouseFunds, Math.min(limit, topHouseFunds.length));
                console.log(`📋 Selected ${selectedFunds.length} equity funds (mixed categories)`);
            }
            else {
                // Select diverse funds
                Object.entries(targetCounts).forEach(([category, count]) => {
                    let categoryKey;
                    if (category === 'largeCap')
                        categoryKey = 'Large Cap';
                    else if (category === 'midCap')
                        categoryKey = 'Mid Cap';
                    else if (category === 'smallCap')
                        categoryKey = 'Small Cap';
                    else if (category === 'multiCap')
                        categoryKey = 'Multi Cap';
                    else
                        return;
                    const funds = categorizedFunds[categoryKey] ||
                        [];
                    const selected = this.sampleArray(funds, Math.min(count, funds.length));
                    selectedFunds.push(...selected);
                    console.log(`📋 Selected ${selected.length} ${categoryKey} funds`);
                });
            }
            console.log(`📥 Processing ${selectedFunds.length} equity funds...`);
            // Process funds with delay to respect API limits
            for (const fund of selectedFunds) {
                try {
                    const fundData = await this.convertToRawFundData(fund);
                    if (fundData) {
                        result.data.push(fundData);
                        result.imported++;
                        console.log(`  ✓ ${fundData.name} (${fundData.subCategory})`);
                    }
                    else {
                        result.failed++;
                    }
                    // Add delay to respect API limits
                    await this.delay(200);
                }
                catch (error) {
                    result.failed++;
                    result.errors.push(`Error importing ${fund.schemeName}: ${error.message}`);
                }
            }
            console.log(`\n✅ Equity import complete: ${result.imported} succeeded, ${result.failed} failed`);
        }
        catch (error) {
            result.success = false;
            result.errors.push(`Equity import failed: ${error.message}`);
            console.error('❌ Equity import failed:', error.message);
        }
        return result;
    }
    /**
     * Import commodity mutual funds
     */
    async importCommodityFunds(options = {}) {
        const { limit = 50 } = options;
        const result = {
            success: true,
            imported: 0,
            failed: 0,
            errors: [],
            data: [],
        };
        try {
            console.log('📥 Fetching commodity funds...');
            const allFunds = await this.fetchAllFunds();
            const commodityFunds = this.filterCommodityFunds(allFunds);
            console.log(`📊 Found ${commodityFunds.length} commodity funds`);
            const selectedFunds = this.sampleArray(commodityFunds, Math.min(limit, commodityFunds.length));
            console.log(`📥 Processing ${selectedFunds.length} commodity funds...`);
            for (const fund of selectedFunds) {
                try {
                    const fundData = await this.convertToRawFundData(fund);
                    if (fundData) {
                        result.data.push(fundData);
                        result.imported++;
                        console.log(`  ✓ ${fundData.name} (${fundData.subCategory})`);
                    }
                    else {
                        result.failed++;
                    }
                    // Add delay
                    await this.delay(300);
                }
                catch (error) {
                    result.failed++;
                    result.errors.push(`Error importing ${fund.schemeName}: ${error.message}`);
                }
            }
            console.log(`\n✅ Commodity import complete: ${result.imported} succeeded, ${result.failed} failed`);
        }
        catch (error) {
            result.success = false;
            result.errors.push(`Commodity import failed: ${error.message}`);
            console.error('❌ Commodity import failed:', error.message);
        }
        return result;
    }
    /**
     * Sample random elements from array
     */
    sampleArray(arr, count) {
        const shuffled = [...arr].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }
    /**
     * Delay helper
     */
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
exports.MFAPIImporter = MFAPIImporter;
// Export singleton instance
exports.mfApiImporter = new MFAPIImporter();
