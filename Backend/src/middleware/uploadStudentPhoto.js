import multer from "multer";

// Configure Multer to use memory storage (prevents saving files locally)
const storage = multer.memoryStorage();

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
