// middleware/uploadStudentPhoto.js

import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = "uploads/students";

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadDir);
  },

  filename(req, file, cb) {
    const ext = path.extname(file.originalname);

    cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`);
  },
});

export const uploadStudentPhoto = multer({
  storage,

  fileFilter(req, file, cb) {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files allowed"));
    }

    cb(null, true);
  },

  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});
