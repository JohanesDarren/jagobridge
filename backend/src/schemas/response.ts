export interface SuccessResponse<T> {
  status: "success";
  message: string;
  data: T;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface PaginatedResponse<T> {
  status: "success";
  message: string;
  data: T[];
  meta: PaginationMeta;
}

export function successResponse<T>(data: T, message = "Success"): SuccessResponse<T> {
  return { status: "success", message, data };
}

export function paginatedResponse<T>(
  data: T[],
  params: { total: number; page: number; limit: number },
  message = "Data retrieved successfully",
): PaginatedResponse<T> {
  const totalPages = params.limit > 0 ? Math.ceil(params.total / params.limit) : 0;
  return {
    status: "success",
    message,
    data,
    meta: {
      page: params.page,
      limit: params.limit,
      total: params.total,
      total_pages: totalPages,
      has_next: params.page < totalPages,
      has_prev: params.page > 1,
    },
  };
}

export function parsePagination(
  query: Record<string, unknown>,
  defaults: { page?: number; limit?: number; maxLimit?: number } = {},
): { page: number; limit: number; offset: number } {
  const maxLimit = defaults.maxLimit ?? 100;
  const rawPage = Number(query.page ?? defaults.page ?? 1);
  const rawLimit = Number(query.limit ?? defaults.limit ?? 20);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), maxLimit) : 20;
  return { page, limit, offset: (page - 1) * limit };
}
