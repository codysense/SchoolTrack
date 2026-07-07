import { v2 as cloudinary } from "cloudinary";
import multer from "multer";

// Configure Cloudinary using environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Multer to use memory storage (so files are not saved to Render's disk)
const storage = multer.memoryStorage();

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

// Helper to stream a file buffer directly to Cloudinary
export const uploadToCloudinary = (fileBuffer, folderName) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folderName,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url); // Returns the HTTPS URL
      },
    );
    uploadStream.end(fileBuffer);
  });
};
