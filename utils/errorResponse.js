/**
 * Custom error response class to standardize API error responses
 * Used throughout the application for consistent error handling
 */
class ErrorResponse extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

export default ErrorResponse; 