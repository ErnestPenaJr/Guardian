import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Creates a multer instance that stores uploaded files in a given folder.
 * @param folderPath Relative or absolute path to save files
 * @returns multer instance
 */
export function createMulterUpload(folderPath: string) {
  const uploadFolder = path.isAbsolute(folderPath)
    ? folderPath
    : path.join(__dirname, "..", folderPath);

  // Ensure folder exists
  if (!fs.existsSync(uploadFolder)) {
    fs.mkdirSync(uploadFolder, { recursive: true });
  }

  // Configure multer storage
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadFolder);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      cb(null, `notice-${uniqueSuffix}${ext}`);
    },
  });

  return multer({ storage });
}
