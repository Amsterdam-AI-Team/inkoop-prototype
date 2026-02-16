'use client'

import { forwardRef } from 'react'
import {
  LinkIcon,
  FormattingBoldIcon,
  FormattingItalicIcon,
  FormattingUnderlineIcon,
  UndoIcon,
  RedoIcon,
} from '@amsterdam/design-system-react-icons'
import {
  MDXEditor,
  type MDXEditorMethods,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  linkPlugin,
  linkDialogPlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  tablePlugin,
  UndoRedo,
  BoldItalicUnderlineToggles,
  CreateLink,
  currentBlockType$,
  convertSelectionToNode$,
  usePublisher,
  useCellValue,
  type IconKey,
} from '@mdxeditor/editor'
import { $createParagraphNode } from 'lexical'
import { $createHeadingNode } from '@lexical/rich-text'
import '@mdxeditor/editor/style.css'
import { CustomLinkDialog } from '@/components/CustomLinkDialog/CustomLinkDialog'
import styles from './ConceptEditor.module.css'

interface ConceptEditorProps {
  markdown: string
  onChange: (markdown: string) => void
  toolbarTop: string
  readOnly?: boolean
  placeholder?: string
}

const customIconComponentFor = (name: IconKey) => {
  const iconMap = {
    undo: UndoIcon,
    redo: RedoIcon,
    format_bold: FormattingBoldIcon,
    format_italic: FormattingItalicIcon,
    format_underlined: FormattingUnderlineIcon,
    link: LinkIcon,
  }

  const IconComponent = iconMap[name as keyof typeof iconMap]
  if (IconComponent) {
    return (
      <span className={styles.iconWrapper}>
        <IconComponent className={styles.icon} />
      </span>
    )
  }

  return null
}

const DutchBlockTypeSelect = () => {
  const convertSelectionToNode = usePublisher(convertSelectionToNode$)
  const currentBlockType = useCellValue(currentBlockType$)

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const blockType = e.target.value
    switch (blockType) {
      case 'paragraph':
        convertSelectionToNode(() => $createParagraphNode())
        break
      default:
        if (blockType.startsWith('h')) {
          convertSelectionToNode(() => $createHeadingNode(blockType as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'))
        }
    }
  }

  return (
    <select
      value={currentBlockType}
      onChange={handleChange}
      className={styles.blockTypeSelect}
      title="Selecteer teksttype"
    >
      <option value="paragraph">Paragraaf</option>
      <option value="h1">Kop 1</option>
      <option value="h2">Kop 2</option>
      <option value="h3">Kop 3</option>
    </select>
  )
}

export const ConceptEditor = forwardRef<MDXEditorMethods, ConceptEditorProps>(
  ({ markdown, onChange, toolbarTop, readOnly = false, placeholder }, ref) => {
    return (
      <>
        <div
          className={styles.wrapper}
          style={{
            // Dynamic toolbar position via CSS variable
            ['--toolbar-top' as string]: toolbarTop,
          }}
        >
          <MDXEditor
            ref={ref}
            markdown={markdown}
            onChange={onChange}
            readOnly={readOnly}
            placeholder={placeholder}
            contentEditableClassName="mdx-editor-styling"
            iconComponentFor={customIconComponentFor}
            plugins={[
              headingsPlugin(),
              listsPlugin(),
              quotePlugin(),
              tablePlugin(),
              linkPlugin(),
              linkDialogPlugin({
                LinkDialog: CustomLinkDialog,
              }),
              thematicBreakPlugin(),
              toolbarPlugin({
                toolbarClassName: 'mdx-editor-toolbar-styling',
                toolbarContents: () => (
                  <>
                    <UndoRedo />
                    <BoldItalicUnderlineToggles />
                    <CreateLink />
                    <DutchBlockTypeSelect />
                  </>
                ),
              }),
            ]}
          />
        </div>
      </>
    )
  }
)

ConceptEditor.displayName = 'ConceptEditor'
