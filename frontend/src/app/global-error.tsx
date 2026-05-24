"use client";

import "./globals.css";
import {
  RuntimeErrorScreen,
  makeRuntimeErrorScreenPropsFromError,
} from "@/components/RuntimeErrorScreen";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <RuntimeErrorScreen
          {...makeRuntimeErrorScreenPropsFromError(error, reset)}
          withRootChrome={false}
        />
      </body>
    </html>
  );
}
