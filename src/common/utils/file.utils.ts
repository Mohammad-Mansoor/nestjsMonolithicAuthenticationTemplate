export class FileUtil {
    static generateFileName(originalName: string): string {
      const timestamp = Date.now();
      const random = Math.round(Math.random() * 1e9);
      const ext = originalName.split('.').pop();
  
      return `${timestamp}-${random}.${ext}`;
    }
  
    static getFileExtension(filename: string): string | undefined {
      return filename.split('.').pop();
    }
  
    static isImage(mimetype: string): boolean {
      return mimetype.startsWith('image/');
    }
  }