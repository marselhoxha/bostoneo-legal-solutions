export enum TransformationType {
  InitialGeneration = 'INITIAL_GENERATION',
  Simplify = 'SIMPLIFY',
  Condense = 'CONDENSE',
  Expand = 'EXPAND',
  Formal = 'FORMAL',
  Persuasive = 'PERSUASIVE',
  Redraft = 'REDRAFT',
  ManualEdit = 'MANUAL_EDIT',
  RestoreVersion = 'RESTORE_VERSION'
}

export enum TransformationScope {
  FullDocument = 'FULL_DOCUMENT',
  Selection = 'SELECTION'
}
