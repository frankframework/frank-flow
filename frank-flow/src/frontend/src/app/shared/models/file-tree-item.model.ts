export const typeConst = ['folder', 'file'] as const;

export type FileTreeItemType = typeof typeConst;

export const fileTypeConst = ['configuration', 'other'] as const;

export type FileTreeFileType = typeof fileTypeConst;

export type FileTreeItemModel = {
  name: string;
  path: string;
} & (FolderItemModel | FileItemModel);

export type FolderItemModel = {
  type: FileTreeItemType[0]; //folder
  children: FileTreeItemModel[];
  expanded: boolean;
};

export type FileItemModel = {
  type: FileTreeItemType[1]; //file
  extension: string;
  saved: boolean;
  firstLoad: boolean;
} & (ConfigurationFile | OtherFile);

export type ConfigurationFile = {
  fileType: FileTreeFileType[0]; //configuration
  flowNeedsUpdate: boolean;
  flowStructures: string[];
  xml: string;
};

export type OtherFile = {
  fileType: FileTreeFileType[1]; //other
};
