"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

export interface ErrorMessage {
  message: string;
  details?: string;
}

interface ErrorStoreContextProps {
  error: ErrorMessage | null;
  setError: (error: ErrorMessage) => void;
  clearError: () => void;
}

const ErrorStoreContext = createContext<ErrorStoreContextProps | undefined>(undefined);

export const ErrorStoreProvider = ({ children }: { children: ReactNode }) => {
  const [error, setErrorState] = useState<ErrorMessage | null>(null);

  const setError = (error: ErrorMessage) => setErrorState(error);
  const clearError = () => setErrorState(null);

  return (
    <ErrorStoreContext.Provider value={{ error, setError, clearError }}>
      {children}
    </ErrorStoreContext.Provider>
  );
};

export const useErrorStore = (): ErrorStoreContextProps => {
  const context = useContext(ErrorStoreContext);
  if (!context) {
    throw new Error("useErrorStore must be used within an ErrorStoreProvider");
  }
  return context;
};
