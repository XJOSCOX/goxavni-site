export function httpError(status, message, code = "request_failed") {
  return Object.assign(new Error(message), { status, code });
}

export function notFound(_req, res) {
  return res.status(404).json({
    error: "API route not found.",
    code: "not_found",
    requestId: res.locals.requestId
  });
}

export function errorHandler(error, _req, res, _next) {
  const isJsonSyntaxError = error instanceof SyntaxError && "body" in error;
  const status = isJsonSyntaxError ? 400 : error.status || 500;
  const code = isJsonSyntaxError ? "invalid_json" : error.code || "server_error";
  const message = isJsonSyntaxError
    ? "Request body must be valid JSON."
    : status === 500 ? "Something went wrong. Please try again." : error.message;

  if (status >= 500) {
    console.error({ requestId: res.locals.requestId, error });
  }

  return res.status(status).json({
    error: message,
    code,
    requestId: res.locals.requestId
  });
}
