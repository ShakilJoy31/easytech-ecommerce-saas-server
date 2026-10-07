const multer = require("multer");
const { uid } = require("uid");

// Set the storage engine and file size limit
const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, "uploads/");
  },

  filename: function (req, file, cb) {
    const filename = `${uid()}-${file.originalname.split(" ").join("-")}`;
    const filelink = `${process.env.API}/${filename}`;
    if (!req.filelinks) {
      req.filelinks = [];
    }
    req.filelinks.push(filelink);
    cb(null, filename);
  },
});

const fileFilter = (req, file, cb) => {
  // Check file type, e.g., only allow images
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Not an image! Please upload only images."), false);
  }
};

const multipleUploadWithMulter = multer({
  storage,
  limits: { fileSize: 5000000 }, // max file size allow 5MB
  fileFilter,
});

module.exports = multipleUploadWithMulter;
