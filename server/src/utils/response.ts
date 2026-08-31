export function apiSuccess<T>(data: T, extra?: { requestId?: string }) {
  return {
    success: true as const,
    data,
    requestId: extra?.requestId,
    timestamp: new Date().toISOString(),
  }
}

export function apiError(error: string, status = 400) {
  return {
    body: {
      success: false as const,
      error,
      timestamp: new Date().toISOString(),
    },
    status: status as 400 | 401 | 403 | 404 | 409 | 423 | 429 | 500,
  }
}
