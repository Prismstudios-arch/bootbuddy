import { Directory, File, Paths } from "expo-file-system";

/**
 * Find photos live on the device, never on our servers.
 *
 * That's a deliberate privacy and cost decision from day one — the privacy
 * policy says we discard scan photos after identification, and it has to
 * stay true. So a thumbnail is just a file named after the find's id, and
 * nothing about it is uploaded.
 *
 * Because the path is derived from the id there's no mapping to keep in
 * sync and nothing to store server-side. If the app is reinstalled the
 * files are gone and the rows simply fall back to their icon, which is
 * exactly the behaviour we want rather than a broken image.
 */
const FOLDER = "find-photos";

function folder(): Directory {
  const dir = new Directory(Paths.document, FOLDER);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

function fileFor(findId: string): File {
  return new File(folder(), `${findId}.jpg`);
}

/** Copy the scan photo into permanent storage under this find's id. */
export function saveFindPhoto(findId: string, sourceUri: string): void {
  try {
    const destination = fileFor(findId);
    if (destination.exists) destination.delete();
    new File(sourceUri).copy(destination);
  } catch {
    // A missing thumbnail is a cosmetic loss, never a reason to fail the
    // buy log — the find itself is already saved on the server.
  }
}

/** Local file URI for a find's photo, or null if there isn't one. */
export function findPhotoUri(findId: string): string | null {
  try {
    const file = fileFor(findId);
    return file.exists ? file.uri : null;
  } catch {
    return null;
  }
}

export function deleteFindPhoto(findId: string): void {
  try {
    const file = fileFor(findId);
    if (file.exists) file.delete();
  } catch {
    // Nothing to clean up.
  }
}
