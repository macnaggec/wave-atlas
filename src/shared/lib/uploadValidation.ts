import { MEDIA_UPLOAD_LIMITS } from 'entities/Media/constants';

/**
 * Validation result for file uploads
 */
export interface FileValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Result for batch validation
 */
export interface BatchValidationResult extends FileValidationResult {
  validFiles: File[];
  invalidFiles: Array<{ file: File; reason: string }>;
}

/**
 * Check if a file type is an image
 */
function isImage(file: File): boolean {
  return file.type.startsWith('image/');
}

/**
 * Check if a file type is a video
 */
function isVideo(file: File): boolean {
  return file.type.startsWith('video/');
}

/**
 * Format bytes to human-readable format
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Validate a single file against upload limits
 */
export function validateFile(file: File): FileValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check file type
  if (!isImage(file) && !isVideo(file)) {
    errors.push(`"${file.name}" is not a valid image or video file`);
    return { valid: false, errors, warnings };
  }

  // Check file size
  const maxSize = isImage(file)
    ? MEDIA_UPLOAD_LIMITS.MAX_FILE_SIZE_IMAGE
    : MEDIA_UPLOAD_LIMITS.MAX_FILE_SIZE_VIDEO;

  if (file.size > maxSize) {
    errors.push(
      `"${file.name}" exceeds maximum size (${formatBytes(file.size)} > ${formatBytes(maxSize)})`
    );
  }

  // Add compression suggestion for large files
  if (isImage(file) && file.size > maxSize * 0.8) {
    warnings.push(
      `"${file.name}" is close to the size limit. Consider compressing it.`
    );
  }

  if (isVideo(file) && file.size > maxSize * 0.8) {
    warnings.push(
      `"${file.name}" is close to the size limit. Consider using 1080p resolution.`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate a batch of files against upload limits
 */
export function validateFileBatch(files: File[]): BatchValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const validFiles: File[] = [];
  const invalidFiles: Array<{ file: File; reason: string }> = [];

  // Check batch size
  if (files.length > MEDIA_UPLOAD_LIMITS.MAX_FILES_PER_BATCH) {
    errors.push(
      `Too many files selected (${files.length}). Maximum ${MEDIA_UPLOAD_LIMITS.MAX_FILES_PER_BATCH} files per batch.`
    );
    return { valid: false, errors, warnings, validFiles, invalidFiles };
  }

  // Calculate total batch size
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  if (totalSize > MEDIA_UPLOAD_LIMITS.MAX_BATCH_SIZE) {
    errors.push(
      `Total batch size too large (${formatBytes(totalSize)}). Maximum ${formatBytes(MEDIA_UPLOAD_LIMITS.MAX_BATCH_SIZE)} per batch.`
    );
  }

  // Validate each file
  files.forEach((file) => {
    const result = validateFile(file);

    if (result.valid) {
      validFiles.push(file);
      warnings.push(...result.warnings);
    } else {
      invalidFiles.push({
        file,
        reason: result.errors.join(', '),
      });
      errors.push(...result.errors);
    }
  });

  return {
    valid: errors.length === 0 && validFiles.length > 0,
    errors,
    warnings,
    validFiles,
    invalidFiles,
  };
}
