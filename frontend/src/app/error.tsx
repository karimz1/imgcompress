"use client";

import { useTranslation } from "react-i18next";
import {
  RuntimeErrorScreen,
  makeRuntimeErrorScreenPropsFromError,
} from "@/components/RuntimeErrorScreen";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useTranslation();

  return (
    <RuntimeErrorScreen
      {...makeRuntimeErrorScreenPropsFromError(error, reset, {
        title: t("runtimeError.title"),
        subtitle: t("runtimeError.subtitle"),
        stackTrace: t("runtimeError.stackTrace"),
        tryAgain: t("runtimeError.tryAgain"),
      })}
    />
  );
}
