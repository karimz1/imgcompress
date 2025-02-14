// @/models/ErrorMessage.ts

// Option 1: Using an interface with an optional property
export interface ErrorMessage {
  message: string;
  details?: string;
  isApiError?: boolean;
}

// Option 2: Using a discriminated union (more strict)
export type ApiError = {
  message: string;
  details?: string;
  isApiError: true;
};

export type ClientError = {
  message: string;
  details?: string;
  isApiError?: false;
};

export type ErrorMessageUnion = ApiError | ClientError;
