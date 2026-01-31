export const pagination = (page: number = 1, limit: number = 10) => {
  const skip = (page - 1) * limit;
  return { skip, take: limit };
};

export const buildSortOrder = (sort?: string) => {
  if (!sort) return undefined;
  
  const [field, direction] = sort.split(':');
  return { [field]: direction === 'desc' ? 'desc' : 'asc' };
};

export const formatResponse = <T>(
  data: T,
  message: string = 'Success',
  statusCode: number = 200
) => {
  return {
    statusCode,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
};

export const formatPaginatedResponse = <T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
  message: string = 'Success'
) => {
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