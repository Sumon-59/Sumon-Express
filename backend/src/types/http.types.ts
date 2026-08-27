// The error shape the whole backend throws: a normal Error carrying an
// HTTP status code, which error.middleware turns into the response.

export interface HttpError extends Error {
  statusCode?: number;
}

// Object.assign gives us Error & { statusCode } without a type cast.
export const httpError = (message: string, statusCode: number): HttpError =>
  Object.assign(new Error(message), { statusCode });
