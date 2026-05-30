import { FileDown, FolderDown } from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";

interface DownloadFileToastProps {
  fileName: string;
}

const DownloadFileToast: React.FC<DownloadFileToastProps> = ({ fileName }) => {
  const { t } = useTranslation();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <FileDown style={{ fontSize: "24px", flexShrink: 0 }} />
      <span style={{ fontSize: "16px", fontWeight: "bold", wordBreak: "break-word" }}>
        {t("drawer.downloadingFile", { fileName })}
      </span>
    </div>
  );
};

const DownloadZipToast: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <FolderDown style={{ fontSize: "24px", flexShrink: 0 }} />
      <span style={{ fontSize: "16px", fontWeight: "bold", wordBreak: "break-word" }}>
        {t("drawer.downloadingZip")}
      </span>
    </div>
  );
};

export { DownloadFileToast, DownloadZipToast };
