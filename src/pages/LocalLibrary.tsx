import { LocalLibraryPage } from '../components/library/LocalLibraryPage';
import type { AssetBundle, UploadedFileRecord } from '../utils/api';

export function LocalLibrary(props: { bundle: AssetBundle; files: UploadedFileRecord[]; apiOnline: boolean; onFilesChanged: (files: UploadedFileRecord[]) => void; onAssetsImported: (bundle: AssetBundle) => void }) {
  return <LocalLibraryPage {...props} />;
}
