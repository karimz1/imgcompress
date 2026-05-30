"use client";

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
  return <RuntimeErrorScreen {...makeRuntimeErrorScreenPropsFromError(error, reset)} />;
}
