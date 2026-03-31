const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.75;
const COMPRESSION_THRESHOLD = 500 * 1024;

function isCompressibleImage(file) {
  const compressibleTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/bmp'];
  return compressibleTypes.includes(file.type);
}

function isHeicFile(file) {
  const name = file.name.toLowerCase();
  return name.endsWith('.heic') || name.endsWith('.heif') ||
    file.type === 'image/heic' || file.type === 'image/heif';
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Falha ao carregar imagem: ${file.name}`));
    };
    img.src = url;
  });
}

function calculateDimensions(width, height, maxDimension) {
  if (width <= maxDimension && height <= maxDimension) {
    return { width, height };
  }

  const ratio = Math.min(maxDimension / width, maxDimension / height);
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  };
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob failed'));
      },
      type,
      quality
    );
  });
}

async function compressImage(file) {
  const img = await loadImage(file);
  const { width, height } = calculateDimensions(img.width, img.height, MAX_DIMENSION);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await canvasToBlob(canvas, 'image/jpeg', JPEG_QUALITY);

  const baseName = file.name.replace(/\.[^.]+$/, '');
  const compressedFile = new File([blob], `${baseName}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });

  return compressedFile;
}

export async function processFileForUpload(file) {
  if (isHeicFile(file)) {
    try {
      const img = await loadImage(file);
      const { width, height } = calculateDimensions(img.width, img.height, MAX_DIMENSION);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      const blob = await canvasToBlob(canvas, 'image/jpeg', JPEG_QUALITY);
      const baseName = file.name.replace(/\.[^.]+$/, '');
      return new File([blob], `${baseName}.jpg`, {
        type: 'image/jpeg',
        lastModified: Date.now(),
      });
    } catch {
      return file;
    }
  }

  if (!isCompressibleImage(file)) {
    return file;
  }

  if (file.size <= COMPRESSION_THRESHOLD) {
    return file;
  }

  try {
    const compressed = await compressImage(file);
    if (compressed.size < file.size) {
      const savings = Math.round(((file.size - compressed.size) / file.size) * 100);
      console.log(
        `Compressed ${file.name}: ${(file.size / 1024).toFixed(0)}KB -> ${(compressed.size / 1024).toFixed(0)}KB (-${savings}%)`
      );
      return compressed;
    }
    return file;
  } catch {
    return file;
  }
}

export async function processFilesForUpload(files) {
  const processed = [];
  for (const file of files) {
    const result = await processFileForUpload(file);
    processed.push(result);
  }
  return processed;
}
