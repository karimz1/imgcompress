import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const PageFooter = (props: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <Card className="w-full max-w-xl mt-8" {...props}>
      <CardHeader>
        <CardTitle>Open Source & Free</CardTitle>
      </CardHeader>

      <CardContent>
        <p className="text-sm text-gray-600">
          This project is <strong>fully open source</strong> to ensure privacy and transparency.
          You can explore or contribute to{" "}
          <a
            href="https://github.com/karimz1/imgcompress"
            className="text-blue-400 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            the source code on GitHub
          </a>.
        </p>

        <p className="text-sm text-gray-600 mt-2">
          Have ideas, feedback, or feature requests? Share them via{" "}
          <a
            href="https://github.com/karimz1/imgcompress/issues"
            className="text-blue-400 hover:underline"
          >
            GitHub Issues
          </a>.
        </p>

        <p className="text-sm text-gray-600 mt-4 border-t pt-3">
          For inquiries or collaboration, contact{" "}
          <a
            href="mailto:mails.karimzouine@gmail.com"
            className="text-blue-400 hover:underline"
          >
            mails.karimzouine@gmail.com
          </a>
        </p>
      </CardContent>
    </Card>
  );
};

export default PageFooter;