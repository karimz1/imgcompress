import sharp from "sharp";

export type DownloadType = {
  newFilePath: string; 
  metadata: sharp.Metadata
}