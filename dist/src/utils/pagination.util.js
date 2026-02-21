/**
 * Pagination Utility
 * Handle pagination for large datasets
 */

class PaginationUtil {
  /**
   * Default pagination settings
   */
  static DEFAULTS = {
    PAGE: 1,
    LIMIT: 2500, // Increased to 2500 to match frontend expectations
    MAX_LIMIT: 15000, // Increased to support fetching all funds at once
  };

  /**
   * Parse pagination parameters from request
   */
  static parsePaginationParams(req) {
    const page = parseInt(req.query.page) || this.DEFAULTS.PAGE;
    const limit = Math.min(
      parseInt(req.query.limit) || this.DEFAULTS.LIMIT,
      this.DEFAULTS.MAX_LIMIT
    );

    // Ensure positive values
    const validPage = Math.max(1, page);
    const validLimit = Math.max(1, limit);

    return {
      page: validPage,
      limit: validLimit,
      skip: (validPage - 1) * validLimit,
    };
  }

  /**
   * Generate pagination metadata
   */
  static generatePaginationMeta(page, limit, total) {
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return {
      currentPage: page,
      totalPages,
      totalItems: total,
      itemsPerPage: limit,
      hasNextPage,
      hasPrevPage,
      nextPage: hasNextPage ? page + 1 : null,
      prevPage: hasPrevPage ? page - 1 : null,
    };
  }

  /**
   * Paginate array data
   */
  static paginateArray(array, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const paginatedData = array.slice(skip, skip + limit);
    const meta = this.generatePaginationMeta(page, limit, array.length);

    return {
      data: paginatedData,
      pagination: meta,
    };
  }

  /**
   * Build pagination response
   */
  static buildResponse(data, page, limit, total) {
    const pagination = this.generatePaginationMeta(page, limit, total);

    return {
      success: true,
      data,
      pagination,
    };
  }

  /**
   * Apply pagination to Mongoose query
   */
  static async paginateMongooseQuery(query, page, limit) {
    const skip = (page - 1) * limit;

    // Execute query with pagination
    const [data, total] = await Promise.all([
      query.skip(skip).limit(limit).lean().exec(),
      query.model.countDocuments(query.getQuery()),
    ]);

    return {
      data,
      pagination: this.generatePaginationMeta(page, limit, total),
    };
  }

  /**
   * Get pagination links (for HATEOAS)
   */
  static generatePaginationLinks(baseUrl, page, limit, total) {
    const totalPages = Math.ceil(total / limit);
    const links = {
      self: `${baseUrl}?page=${page}&limit=${limit}`,
    };

    if (page > 1) {
      links.first = `${baseUrl}?page=1&limit=${limit}`;
      links.prev = `${baseUrl}?page=${page - 1}&limit=${limit}`;
    }

    if (page < totalPages) {
      links.next = `${baseUrl}?page=${page + 1}&limit=${limit}`;
      links.last = `${baseUrl}?page=${totalPages}&limit=${limit}`;
    }

    return links;
  }

  /**
   * Calculate range for "Showing X-Y of Z items"
   */
  static calculateRange(page, limit, total) {
    const start = (page - 1) * limit + 1;
    const end = Math.min(page * limit, total);

    return {
      start,
      end,
      total,
      text: `Showing ${start}-${end} of ${total} items`,
    };
  }

  /**
   * Validate pagination parameters
   */
  static validateParams(page, limit) {
    const errors = [];

    if (!Number.isInteger(page) || page < 1) {
      errors.push('Page must be a positive integer');
    }

    if (!Number.isInteger(limit) || limit < 1) {
      errors.push('Limit must be a positive integer');
    }

    if (limit > this.DEFAULTS.MAX_LIMIT) {
      errors.push(`Limit cannot exceed ${this.DEFAULTS.MAX_LIMIT}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create cursor-based pagination metadata
   */
  static createCursorPagination(items, limit, cursorField = '_id') {
    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, limit) : items;

    let nextCursor = null;
    if (hasMore && data.length > 0) {
      const lastItem = data[data.length - 1];
      nextCursor = lastItem[cursorField];
    }

    return {
      data,
      pagination: {
        hasMore,
        nextCursor,
        limit,
      },
    };
  }
}

module.exports = PaginationUtil;
