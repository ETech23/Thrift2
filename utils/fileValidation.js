const validateImageFile = (file) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(file.mimetype)) {
        throw new Error('Invalid file type. Only JPEG, PNG and WebP images are allowed.');
    }

    if (file.size > maxSize) {
        throw new Error('File too large. Maximum size is 5MB.');
    }

    return true;
};

module.exports = {
    validateImageFile
};
