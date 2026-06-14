import path from 'node:path';

export const DEFAULT_SOURCE_BUCKET = 'lounge-guru-source';
export const DEFAULT_SOURCE_OBJECT = 'latest/PP Lounge Data.xlsx';

export function getCachedWorkbookPath(projectRoot, objectKey = DEFAULT_SOURCE_OBJECT) {
  return path.resolve(projectRoot, '.cache', path.basename(objectKey));
}

export function resolveSourceWorkbookConfig(projectRoot, env = process.env) {
  const bucket = env.LOUNGE_GURU_SOURCE_BUCKET || env.PP_LOUNGE_MAP_SOURCE_BUCKET || DEFAULT_SOURCE_BUCKET;
  const objectKey = env.LOUNGE_GURU_SOURCE_OBJECT || env.PP_LOUNGE_MAP_SOURCE_OBJECT || DEFAULT_SOURCE_OBJECT;
  const sourcePath = env.SOURCE_XLSX || getCachedWorkbookPath(projectRoot, objectKey);

  return {
    bucket,
    objectKey,
    sourcePath,
  };
}
