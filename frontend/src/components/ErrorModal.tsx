"use client";

import React from "react";
import { XCircle } from "lucide-react";
import { useErrorStore } from "@/context/ErrorStore";
import { RuntimeErrorScreen } from "@/components/RuntimeErrorScreen";

const ErrorModal: React.FC = () => {
  const { error, clearError } = useErrorStore();

  if (!error || !error.isApiError) return null;

  return (
    <RuntimeErrorScreen
      title="Error Occurred"
      subtitle="The action couldn't complete. Copy the trace below and open a ticket so it can be fixed."
      detailsLabel="Technical details"
      message={error.message}
      details={error.details}
      testIds={{
        screen: "error-modal",
        summary: "error-message",
        details: "error-details",
        copyBtn: "error-copy-btn",
        openTicketBtn: "error-open-ticket-btn",
      }}
      primaryAction={{
        label: "Close",
        icon: <XCircle className="h-4 w-4" />,
        onClick: clearError,
        className:
          "bg-red-600 text-zinc-50 hover:bg-red-500 border border-red-500/40",
        testId: "error-close-btn",
      }}
    />
  );
};

export default ErrorModal;
