/** A dropped file that was not added, and why. */
export interface SkippedFile {
  name: string;
  /** Folder inside the dropped folder, e.g. "holiday/day1"; "" for a loose file. */
  folder: string;
  reason: "unsupported" | "tooLarge";
}

export interface ErrorMessage {
  message: string;
  details?: string;
  isApiError?: boolean;
  /** Files left out of the last drop; shown as a collapsed list under the message. */
  skippedFiles?: SkippedFile[];
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
