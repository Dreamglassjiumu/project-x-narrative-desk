import { LocalLibraryPage } from '../components/library/LocalLibraryPage';
import type { ArchiveNotifier } from '../components/ui/ArchiveNotice';
import type { AssetBundle, UploadedFileRecord } from '../utils/api';

export function LocalLibrary(props: { bundle: AssetBundle; files: UploadedFileRecord[]; apiOnline: boolean; onFilesChanged: (files: UploadedFileRecord[]) => void; onAssetsChanged: (bundle: AssetBundle) => void; onAssetsImported: (bundle: AssetBundle) => void; notify: ArchiveNotifier }) {
  return <LocalLibraryPage {...props} />;
}
