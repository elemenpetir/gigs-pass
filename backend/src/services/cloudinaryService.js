const cloudinary = require("../config/cloudinary");

const EVENT_IMAGE_FOLDER = "gigspass/events";

const uploadImage = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder || EVENT_IMAGE_FOLDER,
        resource_type: "image",
      },
      (error, result) => {
        if (error) {
          const err = new Error("Failed to upload image");
          err.statusCode = 502;
          err.cause = error;
          reject(err);
          return;
        }
        resolve(result);
      },
    );

    stream.end(buffer);
  });
};

const deleteImage = (publicId) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(publicId, (error, result) => {
      if (error) {
        const err = new Error("Failed to delete image");
        err.statusCode = 502;
        err.cause = error;
        reject(err);
        return;
      }
      resolve(result);
    });
  });
};

module.exports = {
  uploadImage,
  deleteImage,
};
