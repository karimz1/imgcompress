"use client";

import "./globals.css";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();

  return (
    <html lang="en">
      <body>
        <RuntimeErrorScreen
          {...makeRuntimeErrorScreenPropsFromError(error, reset, {
            title: t("runtimeError.title"),
            subtitle: t("runtimeError.subtitle"),
            stackTrace: t("runtimeError.stackTrace"),
            tryAgain: t("runtimeError.tryAgain"),
          })}
          withRootChrome={false}
        />
      </body>
    </html>
  );
}
