"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.amfiService = exports.AMFIService = void 0;
// Using native fetch available in Node.js 18+
const db_1 = require("../db");
const cacheService_1 = require("./cacheService");
class AMFIService {
    constructor() {
        this.AMFI_NAV_URL = process.env.AMFI_NAV_URL ||
            'https://portal.amfiindia.com/DownloadNAVHistoryReport_Po.aspx?mf=0&tp=1&frmdt=01-Jan-2024&todt=31-Dec-2024';
    }
    async ingestNAVData(url) {
        const targetUrl = url || this.AMFI_NAV_URL;
        const errors = [];
        let processed = 0;
        try {
            console.log(`Starting AMFI NAV ingestion from: ${targetUrl}`);
            const response = await fetch(targetUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const content = await response.text();
            const records = this.parseNAVFile(content);
            console.log(`Parsed ${records.length} NAV records`);
            // Process in batches to avoid overwhelming the database
            const batchSize = 1000;
            for (let i = 0; i < records.length; i += batchSize) {
                const batch = records.slice(i, i + batchSize);
                try {
                    await this.processBatch(batch);
                    processed += batch.length;
                    console.log(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(records.length / batchSize)}`);
                }
                catch (error) {
                    const errorMsg = `Batch ${Math.floor(i / batchSize) + 1} failed: ${error}`;
                    console.error(errorMsg);
                    errors.push(errorMsg);
                }
            }
            // Invalidate relevant caches
            await this.invalidateCache();
            console.log(`AMFI ingestion completed. Processed: ${processed}, Errors: ${errors.length}`);
            return { processed, errors };
        }
        catch (error) {
            console.error('AMFI ingestion failed:', error);
            errors.push(`Ingestion failed: ${error}`);
            return { processed, errors };
        }
    }
    parseNAVFile(content) {
        const lines = content.split('\n');
        const records = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            // Skip empty lines and headers
            if (!line || line.includes('Scheme Name') || line.includes('AMFI Code')) {
                continue;
            }
            try {
                const record = this.parseNAVLine(line);
                if (record) {
                    records.push(record);
                }
            }
            catch (error) {
                console.warn(`Error parsing line ${i + 1}: ${line}`, error);
            }
        }
        return records;
    }
    parseNAVLine(line) {
        // AMFI NAV file format (semicolon separated):
        // AMFI_Code;ISIN_Div_Payout_Growth;ISIN_Div_Reinvestment;Scheme_Name;Net_Asset_Value;Date
        const parts = line.split(';');
        if (parts.length < 6) {
            return null;
        }
        const [amfiCode, isinDivPayoutGrowth, isinDivReinvestment, schemeName, navStr, dateStr,] = parts;
        // Validate required fields
        if (!amfiCode || !schemeName || !navStr || !dateStr) {
            return null;
        }
        // Parse NAV
        const nav = parseFloat(navStr);
        if (isNaN(nav) || nav <= 0) {
            return null;
        }
        // Parse date (format: DD-MMM-YYYY)
        const date = this.parseDate(dateStr);
        if (!date) {
            return null;
        }
        return {
            amfiCode: amfiCode.trim(),
            isinDivPayoutGrowth: isinDivPayoutGrowth.trim(),
            isinDivReinvestment: isinDivReinvestment.trim(),
            schemeName: schemeName.trim(),
            nav,
            date,
        };
    }
    parseDate(dateStr) {
        try {
            // Expected format: DD-MMM-YYYY (e.g., 01-Jan-2024)
            const parts = dateStr.trim().split('-');
            if (parts.length !== 3) {
                return null;
            }
            const [day, monthStr, year] = parts;
            const monthMap = {
                Jan: 0,
                Feb: 1,
                Mar: 2,
                Apr: 3,
                May: 4,
                Jun: 5,
                Jul: 6,
                Aug: 7,
                Sep: 8,
                Oct: 9,
                Nov: 10,
                Dec: 11,
            };
            const month = monthMap[monthStr];
            if (month === undefined) {
                return null;
            }
            const date = new Date(parseInt(year), month, parseInt(day));
            return isNaN(date.getTime()) ? null : date;
        }
        catch (error) {
            return null;
        }
    }
    async processBatch(records) {
        // Group records by fund for efficient processing
        const fundGroups = new Map();
        for (const record of records) {
            if (!fundGroups.has(record.amfiCode)) {
                fundGroups.set(record.amfiCode, []);
            }
            fundGroups.get(record.amfiCode).push(record);
        }
        // Process each fund
        for (const [amfiCode, fundRecords] of fundGroups) {
            await this.processFundRecords(amfiCode, fundRecords);
        }
    }
    async processFundRecords(amfiCode, records) {
        // Ensure fund exists
        const firstRecord = records[0];
        const fund = await db_1.prisma.fund.upsert({
            where: { amfiCode },
            update: {
                name: firstRecord.schemeName,
                updatedAt: new Date(),
            },
            create: {
                amfiCode,
                name: firstRecord.schemeName,
                type: this.inferFundType(firstRecord.schemeName),
                category: this.inferFundCategory(firstRecord.schemeName),
            },
        });
        // Batch upsert NAV records
        const navData = records.map((record) => ({
            fundId: fund.id,
            date: record.date,
            nav: record.nav,
        }));
        // Use upsert for each NAV record to handle duplicates
        for (const nav of navData) {
            await db_1.prisma.fundPerformance.upsert({
                where: {
                    fundId_date: {
                        fundId: nav.fundId,
                        date: nav.date,
                    },
                },
                update: {
                    nav: nav.nav,
                },
                create: nav,
            });
        }
    }
    inferFundType(schemeName) {
        const name = schemeName.toLowerCase();
        if (name.includes('equity') || name.includes('growth'))
            return 'EQUITY';
        if (name.includes('debt') || name.includes('bond') || name.includes('gilt'))
            return 'DEBT';
        if (name.includes('hybrid') || name.includes('balanced'))
            return 'HYBRID';
        if (name.includes('liquid') || name.includes('money market'))
            return 'LIQUID';
        return 'OTHER';
    }
    inferFundCategory(schemeName) {
        const name = schemeName.toLowerCase();
        if (name.includes('large cap') || name.includes('blue chip'))
            return 'LARGE_CAP';
        if (name.includes('mid cap') || name.includes('midcap'))
            return 'MID_CAP';
        if (name.includes('small cap') || name.includes('smallcap'))
            return 'SMALL_CAP';
        if (name.includes('multi cap') || name.includes('multicap'))
            return 'MULTI_CAP';
        if (name.includes('sectoral') || name.includes('thematic'))
            return 'SECTORAL';
        if (name.includes('international') || name.includes('global'))
            return 'INTERNATIONAL';
        return 'OTHER';
    }
    async invalidateCache() {
        try {
            // Invalidate funds list cache
            await cacheService_1.cacheService.delPattern('funds:list:*');
            // Invalidate fund detail cache
            await cacheService_1.cacheService.delPattern('fund:detail:*');
            // Invalidate NAV cache
            await cacheService_1.cacheService.delPattern('fund:navs:*');
            console.log('Cache invalidated after AMFI ingestion');
        }
        catch (error) {
            console.error('Cache invalidation error:', error);
        }
    }
}
exports.AMFIService = AMFIService;
exports.amfiService = new AMFIService();
