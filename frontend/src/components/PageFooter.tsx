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
          Check out the source code on{" "}
          <a
            href="https://github.com/karimz1/imgcompress"
            className="text-blue-400 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>.
        </p>
        <p className="text-sm text-gray-600 mt-2">
          Created by <strong>Karim Zouine</strong>. Donations are very welcome,
          if you find this tool useful 🤗 My PayPal:{" "}
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
