import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const PageFooter = (props: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <Card className={`w-full max-w-xl mt-8`} {...props}>
      <CardHeader>
        <CardTitle>Open Source & Free</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600">
          This project is <strong>open source</strong> and freely available.
          Check out {" "}
          <a
            href="https://github.com/karimz1/imgcompress"
            className="text-blue-400 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            the Source Code
          </a>.
        </p>
        <p className="text-sm text-gray-600 mt-2">
          Created by <strong>Karim Zouine</strong>. If you find this tool useful, please consider donating to help support future features.
          {" "} <strong><a
            href="https://paypal.me/KarimZouine972"
            className="text-blue-400 hover:underline ml-1"
          >
            🤗 My PayPal
          </a></strong>.
          </p>
          <p className="text-sm text-gray-600 mt-2">
          Got ideas for new features? Share them on my
          <a
            href="https://github.com/karimz1/imgcompress/issues"
            className="text-blue-400 hover:underline ml-1"
          >
            GitHub Issues page
          </a>. Thank you.
        </p>

      </CardContent>
    </Card>
  );
};

export default PageFooter;
