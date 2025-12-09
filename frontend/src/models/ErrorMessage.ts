export interface ErrorMessage {
  message: string;
  details?: string;
  isApiError?: boolean;
}


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
