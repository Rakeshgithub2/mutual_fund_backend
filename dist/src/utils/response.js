"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatPaginatedResponse = exports.formatResponse = exports.buildSortOrder = exports.pagination = void 0;
const pagination = (page = 1, limit = 10) => {
    const skip = (page - 1) * limit;
    return { skip, take: limit };
};
exports.pagination = pagination;
const buildSortOrder = (sort) => {
    if (!sort)
        return undefined;
    const [field, direction] = sort.split(':');
    return { [field]: direction === 'desc' ? 'desc' : 'asc' };
};
exports.buildSortOrder = buildSortOrder;
const formatResponse = (data, message = 'Success', statusCode = 200) => {
    return {
        statusCode,
        message,
        data,
        timestamp: new Date().toISOString(),
    };
};
exports.formatResponse = formatResponse;
const formatPaginatedResponse = (data, total, page, limit, message = 'Success') => {
    const totalPages = Math.ceil(total / limit);
    return {
        statusCode: 200,
        message,
        data,
        pagination: {
            total,
            page,
            limit,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
        },
        timestamp: new Date().toISOString(),
    };
};
exports.formatPaginatedResponse = formatPaginatedResponse;
