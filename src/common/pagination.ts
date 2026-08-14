import { FilterQuery } from 'mongoose';

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 50;

export interface Pagination {
  page: number;
  limit: number;
  skip: number;
  sort: 'asc' | 'desc';
}

function toPositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.floor(parsed);
}

export function parsePagination(
  query: Record<string, unknown>,
): Pagination {
  const page = toPositiveInt(query.page, 1);
  const limit = Math.min(
    toPositiveInt(query.limit, DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );
  const sort = query.sort === 'desc' ? ('desc' as const) : ('asc' as const);
  return { page, limit, skip: (page - 1) * limit, sort };
}

export function regexFilter(field: string): FilterQuery<unknown> {
  return { $regex: new RegExp(field, 'i') };
}