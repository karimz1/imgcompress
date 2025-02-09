export class ImageFileDto {
    public fileName: string;
    public width?: number;
  
    constructor(fileName: string, width?: number) {
      this.fileName = fileName;
      if (width !== undefined) {
        this.width = width;
      }
    }
  }
  