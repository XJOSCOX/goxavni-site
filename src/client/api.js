export const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD"
});

export class ApiError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "ApiError";
    this.status = details.status || 0;
    this.code = details.code || "request_failed";
    this.requestId = details.requestId || "";
  }
}

export async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      ...options
    });
  } catch {
    throw new ApiError("Network error. Check your connection and try again.", { code: "network_error" });
  }

  const requestId = response.headers.get("X-Request-Id") || "";
  const contentType = response.headers.get("Content-Type") || "";
  const data = contentType.includes("application/json") ? await response.json().catch(() => ({})) : {};

  if (!response.ok) {
    throw new ApiError(data.error || "Request failed.", {
      status: response.status,
      code: data.code,
      requestId: data.requestId || requestId
    });
  }

  return data;
}

export function payload(form) {
  return Object.fromEntries(new FormData(form).entries());
}

export function messageForError(error) {
  if (error?.status === 401) return "Your session expired. Please sign in again.";
  if (error?.status === 403) return "You do not have permission to do that.";
  if (error?.status === 404) return "That item or API route was not found.";
  if (error?.status >= 500 && error.requestId) {
    return `${error.message} Reference: ${error.requestId}`;
  }
  return error?.message || "Something went wrong. Please try again.";
}
