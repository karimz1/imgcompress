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
          This project is <strong>fully open-source</strong> and available for everyone to use,
          improve, and learn from. You can explore or contribute to{" "}
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
          Built and maintained by <strong>Karim Zouine</strong> in his free time.
          If this tool helps you or becomes part of your workflow,
          you can support development with a donation — it truly helps 💙
          <strong>
            <a
              href="https://paypal.me/KarimZouine972"
              className="text-blue-400 hover:underline ml-1"
            >
              Donate via PayPal
            </a>
          </strong>.
        </p>

        <p className="text-sm text-gray-600 mt-2">
          Have ideas, feedback, or feature requests?
          Share them on{" "}
          <a
            href="https://github.com/karimz1/imgcompress/issues"
            className="text-blue-400 hover:underline"
          >
            GitHub Issues
          </a>.
        </p>

        <p className="text-sm text-gray-600 mt-4 border-t pt-3">
          For inquiries or collaboration, contact:{" "}
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
