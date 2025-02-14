import { FileDown, FolderDown } from "lucide-react";
import React from "react";

const DownloadFileToast: React.FC<DownloadFileToastProps> = ({ fileName }) => (
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <FileDown style={{ fontSize: "24px", flexShrink: 0 }} /> {}
      <span style={{ fontSize: "16px", fontWeight: "bold", wordBreak: "break-word" }}>
        Downloading: <strong>{fileName}</strong>...
      </span>
    </div>
  );


  const DownloadZipToast: React.FC = () => (
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <FolderDown style={{ fontSize: "24px", flexShrink: 0 }} /> {}
      <span style={{ fontSize: "16px", fontWeight: "bold", wordBreak: "break-word" }}>
        Downloading: <strong>Folder</strong>...
      </span>
    </div>
  );
  
  interface DownloadFileToastProps {
    fileName: string
  }

export{
    DownloadFileToast, DownloadZipToast
};