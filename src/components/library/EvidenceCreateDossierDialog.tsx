import { useState } from 'react';
import type { AnyAsset } from '../../data';
import type { AssetBundle, UploadedFileRecord } from '../../utils/api';
import { archiveErrorMessage, createAsset, updateUpload } from '../../utils/api';
import type { AssetType } from '../../utils/assetHelpers';
import { DossierTemplatePicker } from '../templates/DossierTemplatePicker';
import type { DossierTemplateId } from '../templates/templateDefaults';
import { templateById } from '../templates/templateDefaults';
import { AssetFormDrawer } from '../forms/AssetFormDrawer';

export function EvidenceCreateDossierDialog({ file, bundle, onClose, onCreated, onError }: { file?: UploadedFileRecord; bundle: AssetBundle; onClose: () => void; onCreated: (type: AssetType, asset: AnyAsset, file: UploadedFileRecord) => void; onError: (message: string) => void }) {
  const [templateId, setTemplateId] = useState<DossierTemplateId | undefined>();
  if (!file) return null;
  const template = templateId ? templateById(templateId) : undefined;
  const initialAsset: Partial<AnyAsset> = {
    name: file.name.replace(/\.[^.]+$/, ''),
    sourceNotes: [`Created from local evidence: ${file.name}`],
    tags: file.tags ?? [],
  };
  return (
    <>
      <DossierTemplatePicker open={!templateId} onClose={onClose} onPick={setTemplateId} />
      {template ? <AssetFormDrawer open type={template.type} templateId={templateId} initialAsset={initialAsset} bundle={bundle} onClose={onClose} onSubmit={async (asset) => {
        try {
          const saved = await createAsset(template.type, asset);
          const savedFile = await updateUpload(file.id, { tags: file.tags ?? [], fileUsage: file.fileUsage || 'other', linkedAssetIds: [...new Set([...(file.linkedAssetIds ?? []), saved.id])] });
          onCreated(template.type, saved, savedFile);
          onClose();
        } catch (error) { const message = archiveErrorMessage(error, 'Write failed'); onError(message); throw error; }
      }} /> : null}
    </>
  );
}
