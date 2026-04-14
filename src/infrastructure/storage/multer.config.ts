import { diskStorage } from 'multer';
import { FileUtil } from '../../common/utils/file.utils';
import * as fs from 'fs';

export const multerConfig = (subFolder: string = '') => ({
  storage: diskStorage({
    destination: (req, file, cb) => {
      const path = `./uploads/${subFolder}`;
      if (!fs.existsSync(path)) {
        fs.mkdirSync(path, { recursive: true });
      }
      cb(null, path);
    },
    filename: (req, file, cb) => {
      const filename = FileUtil.generateFileName(file.originalname);
      cb(null, filename);
    },
  }),
});