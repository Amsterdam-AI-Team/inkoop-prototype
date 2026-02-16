export type CollectionType = 'inkoopstrategie' | 'leidraad'

export interface FlowTemplate {
  name: string
  description: string
  template_name: string
  template_content: string
}

export interface CollectionTemplate {
  type: CollectionType
  displayName: string
  description: string
  flows: FlowTemplate[]
  enabled: boolean
}

export interface StandardCheckbox {
  name: string
  checked: boolean
}
