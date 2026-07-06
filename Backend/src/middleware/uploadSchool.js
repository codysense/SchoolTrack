import multer from "multer";
import path from "path";
import fs from "fs";

const logoDir = "uploads/school-logos";
const sigDir = "uploads/principal-signatures";

// Ensure both upload directories exist
if (!fs.existsSync(logoDir)) fs.mkdirSync(logoDir, { recursive: true });
if (!fs.existsSync(sigDir)) fs.mkdirSync(sigDir, { recursive: true });

const storage = multer.diskStorage({
  destination(req, file, cb) {
    if (file.fieldname === "logo") {
      cb(null, logoDir);
    } else if (file.fieldname === "principalSignature") {
      cb(null, sigDir);
    } else {
      cb(new Error("Unexpected field name"), null);
    }
  },
  filename(req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`);
  },
});

export const uploadSchoolFiles = multer({
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
