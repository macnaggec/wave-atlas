import exifr from 'exifr';
import { logger } from './logger';

export interface ExifData {
  capturedAt: Date | null;
  source: 'exif' | 'fallback';
  latitude?: number;
  longitude?: number;
  camera?: string;
  lens?: string;
}

/**
 * Extracts EXIF metadata from an image file
 * Focuses on date/time and GPS coordinates
 */
export async function extractExifData(file: File): Promise<ExifData> {
  try {
    // Only process image files
    if (!file.type.startsWith('image/')) {
      return {
        capturedAt: new Date(file.lastModified),
        source: 'fallback',
      };
    }

    // Extract EXIF data
    const exif = await exifr.parse(file, {
      // Only parse needed segments for performance
      tiff: true,
      exif: true,
      gps: true,
      // Pick only needed tags
      pick: [
        'DateTimeOriginal',
        'CreateDate',
        'ModifyDate',
        'GPSLatitude',
        'GPSLongitude',
        'Make',
        'Model',
        'LensModel',
      ],
    });

    if (!exif) {
      return {
        capturedAt: new Date(file.lastModified),
        source: 'fallback',
      };
    }

    // Try to get the most reliable date (in order of preference)
    const capturedAt =
      exif.DateTimeOriginal ||
      exif.CreateDate ||
      exif.ModifyDate ||
      new Date(file.lastModified);

    const source = exif.DateTimeOriginal || exif.CreateDate ? 'exif' : 'fallback';

    // Build camera string if available
    const camera =
      exif.Make && exif.Model
        ? `${exif.Make} ${exif.Model}`.trim()
        : undefined;

    return {
      capturedAt: capturedAt instanceof Date ? capturedAt : new Date(capturedAt),
      source,
      latitude: exif.GPSLatitude,
      longitude: exif.GPSLongitude,
      camera,
      lens: exif.LensModel,
    };
  } catch (error) {
    logger.warn('EXIF extraction failed', {
      error,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    });
    // Fallback to file modification date
    return {
      capturedAt: new Date(file.lastModified),
      source: 'fallback',
    };
  }
}

/**
 * Extracts EXIF data from multiple files in parallel
 */
export async function extractExifDataBatch(
  files: File[]
): Promise<Map<File, ExifData>> {
  const results = await Promise.all(
    files.map(async (file) => {
      const data = await extractExifData(file);
      return [file, data] as const;
    })
  );

  return new Map(results);
}
