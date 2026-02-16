import { NextRequest, NextResponse } from 'next/server'
import { ensureBaseUrl, getAuthToken, createAuthHeaders } from '@/lib/api/utils'
import { Document, Packer, Paragraph, HeadingLevel, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx'
import MarkdownIt from 'markdown-it'
import { capitalize } from '@/utils/string'

interface Collection {
  id: string
  name: string
  status: string
}

interface Flow {
  id: string
  name: string
  status: string
}

interface Run {
  id: string
  status: 'running' | 'succeeded' | 'failed'
  is_user_edited?: boolean
  edited_response?: string
  created_at: string
}

interface Generation {
  response: string
}

interface RunWithGenerations {
  run: Run
  generations: Generation[]
}

const md = new MarkdownIt()

/**
 * Parse markdown token and convert to docx paragraphs or tables
 * Shifts heading levels down by 1 (H1 becomes H2, H2 becomes H3, etc.)
 */
function tokenToParagraphs(token: any, tokens: any[], idx: number): (Paragraph | Table)[] {
  const paragraphs: (Paragraph | Table)[] = []

  if (token.type === 'heading_open') {
    const level = parseInt(token.tag.substring(1)) // Extract number from h1, h2, etc.
    const contentToken = tokens[idx + 1]

    if (contentToken && contentToken.type === 'inline') {
      const text = parseInlineContent(contentToken)

      // Shift heading levels down by 1 (H1→H2, H2→H3, etc.)
      const docxLevel = Math.min(level + 1, 6) as 1 | 2 | 3 | 4 | 5 | 6
      const headingLevelMap = {
        2: HeadingLevel.HEADING_2,
        3: HeadingLevel.HEADING_3,
        4: HeadingLevel.HEADING_4,
        5: HeadingLevel.HEADING_5,
        6: HeadingLevel.HEADING_6,
      } as const

      paragraphs.push(
        new Paragraph({
          text,
          heading: headingLevelMap[docxLevel] || HeadingLevel.HEADING_2,
          spacing: {
            after: 200, // 10pt spacing after headings
          },
        })
      )
    }
  } else if (token.type === 'paragraph_open') {
    const contentToken = tokens[idx + 1]

    if (contentToken && contentToken.type === 'inline') {
      const runs = parseInlineContentWithFormatting(contentToken)

      paragraphs.push(
        new Paragraph({
          children: runs,
          spacing: {
            after: 200, // 10pt spacing after paragraphs
          },
        })
      )
    }
  } else if (token.type === 'bullet_list_open') {
    // Find all list items
    let i = idx + 1
    while (i < tokens.length && tokens[i].type !== 'bullet_list_close') {
      if (tokens[i].type === 'list_item_open') {
        // Find the paragraph inside the list item
        let j = i + 1
        while (j < tokens.length && tokens[j].type !== 'list_item_close') {
          if (tokens[j].type === 'paragraph_open' && tokens[j + 1]?.type === 'inline') {
            const runs = parseInlineContentWithFormatting(tokens[j + 1])
            paragraphs.push(
              new Paragraph({
                children: runs,
                bullet: {
                  level: 0,
                },
                spacing: {
                  after: 100, // 5pt spacing after list items
                },
              })
            )
          }
          j++
        }
      }
      i++
    }
  } else if (token.type === 'ordered_list_open') {
    // Find all list items
    let i = idx + 1
    let itemNumber = 0
    while (i < tokens.length && tokens[i].type !== 'ordered_list_close') {
      if (tokens[i].type === 'list_item_open') {
        // Find the paragraph inside the list item
        let j = i + 1
        while (j < tokens.length && tokens[j].type !== 'list_item_close') {
          if (tokens[j].type === 'paragraph_open' && tokens[j + 1]?.type === 'inline') {
            const runs = parseInlineContentWithFormatting(tokens[j + 1])
            paragraphs.push(
              new Paragraph({
                children: runs,
                numbering: {
                  reference: 'default-numbering',
                  level: 0,
                },
                spacing: {
                  after: 100, // 5pt spacing after list items
                },
              })
            )
            itemNumber++
          }
          j++
        }
      }
      i++
    }
  } else if (token.type === 'table_open') {
    // Parse table structure
    const tableRows: TableRow[] = []
    let i = idx + 1

    while (i < tokens.length && tokens[i].type !== 'table_close') {
      if (tokens[i].type === 'thead_open' || tokens[i].type === 'tbody_open') {
        i++
        continue
      }

      if (tokens[i].type === 'tr_open') {
        const cellData: Array<{ text: string; isHeader: boolean }> = []
        let j = i + 1

        // First pass: collect cell data
        while (j < tokens.length && tokens[j].type !== 'tr_close') {
          if (tokens[j].type === 'th_open' || tokens[j].type === 'td_open') {
            const isHeader = tokens[j].type === 'th_open'

            // Get cell content
            const inlineToken = tokens[j + 1]
            let cellText = ''

            if (inlineToken && inlineToken.type === 'inline') {
              cellText = parseInlineContent(inlineToken)
            }

            cellData.push({ text: cellText, isHeader })
          }
          j++
        }

        // Second pass: create cells with proper widths
        if (cellData.length > 0) {
          const cellWidth = 100 / cellData.length
          const cells = cellData.map(
            ({ text, isHeader }) =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text, bold: isHeader })],
                  }),
                ],
                width: {
                  size: cellWidth,
                  type: WidthType.PERCENTAGE,
                },
              })
          )

          tableRows.push(new TableRow({ children: cells }))
        }

        i = j
      }
      i++
    }

    if (tableRows.length > 0) {
      paragraphs.push(
        new Table({
          rows: tableRows,
          width: {
            size: 100,
            type: WidthType.PERCENTAGE,
          },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1 },
            bottom: { style: BorderStyle.SINGLE, size: 1 },
            left: { style: BorderStyle.SINGLE, size: 1 },
            right: { style: BorderStyle.SINGLE, size: 1 },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
            insideVertical: { style: BorderStyle.SINGLE, size: 1 },
          },
        })
      )
    }
  }

  return paragraphs
}

/**
 * Parse inline content and return plain text
 */
function parseInlineContent(token: any): string {
  if (!token.children) return ''

  return token.children
    .map((child: any) => {
      if (child.type === 'text') return child.content
      if (child.type === 'code_inline') return child.content
      if (child.type === 'strong_open' || child.type === 'strong_close') return ''
      if (child.type === 'em_open' || child.type === 'em_close') return ''
      return child.content || ''
    })
    .join('')
}

/**
 * Parse inline content with formatting (bold, italic) and return TextRuns
 */
function parseInlineContentWithFormatting(token: any): TextRun[] {
  if (!token.children) return [new TextRun('')]

  const runs: TextRun[] = []
  let currentText = ''
  let isBold = false
  let isItalic = false

  for (const child of token.children) {
    if (child.type === 'text' || child.type === 'code_inline') {
      currentText += child.content
    } else if (child.type === 'strong_open') {
      if (currentText) {
        runs.push(new TextRun({ text: currentText, bold: isBold, italics: isItalic }))
        currentText = ''
      }
      isBold = true
    } else if (child.type === 'strong_close') {
      if (currentText) {
        runs.push(new TextRun({ text: currentText, bold: isBold, italics: isItalic }))
        currentText = ''
      }
      isBold = false
    } else if (child.type === 'em_open') {
      if (currentText) {
        runs.push(new TextRun({ text: currentText, bold: isBold, italics: isItalic }))
        currentText = ''
      }
      isItalic = true
    } else if (child.type === 'em_close') {
      if (currentText) {
        runs.push(new TextRun({ text: currentText, bold: isBold, italics: isItalic }))
        currentText = ''
      }
      isItalic = false
    }
  }

  if (currentText) {
    runs.push(new TextRun({ text: currentText, bold: isBold, italics: isItalic }))
  }

  return runs.length > 0 ? runs : [new TextRun('')]
}

/**
 * Convert markdown text to docx paragraphs and tables
 */
function markdownToDocx(markdown: string): (Paragraph | Table)[] {
  const tokens = md.parse(markdown, {})
  const paragraphs: (Paragraph | Table)[] = []

  const processedIndices = new Set<number>()

  for (let i = 0; i < tokens.length; i++) {
    if (processedIndices.has(i)) continue

    const token = tokens[i]
    const newParagraphs = tokenToParagraphs(token, tokens, i)

    if (newParagraphs.length > 0) {
      paragraphs.push(...newParagraphs)

      // Mark tokens as processed
      if (token.type === 'heading_open') {
        processedIndices.add(i) // heading_open
        processedIndices.add(i + 1) // inline
        processedIndices.add(i + 2) // heading_close
      } else if (token.type === 'paragraph_open') {
        processedIndices.add(i) // paragraph_open
        processedIndices.add(i + 1) // inline
        processedIndices.add(i + 2) // paragraph_close
      } else if (token.type === 'bullet_list_open' || token.type === 'ordered_list_open') {
        // Mark all tokens until the closing tag
        let j = i
        const closeType = token.type === 'bullet_list_open' ? 'bullet_list_close' : 'ordered_list_close'
        while (j < tokens.length && tokens[j].type !== closeType) {
          processedIndices.add(j)
          j++
        }
        processedIndices.add(j) // close tag
      } else if (token.type === 'table_open') {
        // Mark all tokens until the closing tag
        let j = i
        while (j < tokens.length && tokens[j].type !== 'table_close') {
          processedIndices.add(j)
          j++
        }
        processedIndices.add(j) // table_close tag
      }
    }
  }

  return paragraphs
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ collection_id: string }> }) {
  try {
    const baseUrl = ensureBaseUrl()
    const token = await getAuthToken()

    if (!token) {
      return NextResponse.json({ detail: 'Missing Authorization header' }, { status: 401 })
    }

    const { collection_id } = await params

    // Fetch collection info
    const collectionRes = await fetch(`${baseUrl}/collections/${collection_id}`, {
      method: 'GET',
      headers: createAuthHeaders(token),
    })

    if (!collectionRes.ok) {
      return NextResponse.json({ detail: 'Collection not found' }, { status: 404 })
    }

    const collection: Collection = await collectionRes.json()

    // Fetch all flows for this collection
    const flowsRes = await fetch(`${baseUrl}/collections/${collection_id}/flows`, {
      method: 'GET',
      headers: createAuthHeaders(token),
    })

    if (!flowsRes.ok) {
      return NextResponse.json({ detail: 'Failed to fetch flows' }, { status: 500 })
    }

    const allFlows: Flow[] = await flowsRes.json()

    // Filter flows with status='done'
    const doneFlows = allFlows.filter((flow) => flow.status === 'done')

    if (doneFlows.length === 0) {
      return NextResponse.json({ detail: 'No completed chapters found' }, { status: 404 })
    }

    // Collect all chapter content
    const chapters: Array<{ name: string; content: string }> = []

    for (const flow of doneFlows) {
      // Fetch all runs for this flow
      const runsRes = await fetch(`${baseUrl}/flows/${flow.id}/runs`, {
        method: 'GET',
        headers: createAuthHeaders(token),
      })

      if (!runsRes.ok) {
        console.error(`Failed to fetch runs for flow ${flow.id}`)
        continue
      }

      const runs: Run[] = await runsRes.json()

      // Find the most recent successful run
      const successfulRuns = runs.filter((run) => run.status === 'succeeded')

      if (successfulRuns.length === 0) {
        console.error(`No successful runs for flow ${flow.id}`)
        continue
      }

      // Sort by created_at descending to get the most recent
      const mostRecentRun = successfulRuns.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0]

      let chapterText = ''

      // Check if there's a user-edited version
      if (mostRecentRun.is_user_edited && mostRecentRun.edited_response) {
        chapterText = mostRecentRun.edited_response
      } else {
        // Fetch the run with generations to get the generated text
        const runDetailRes = await fetch(`${baseUrl}/flows/${flow.id}/runs/${mostRecentRun.id}`, {
          method: 'GET',
          headers: createAuthHeaders(token),
        })

        if (!runDetailRes.ok) {
          console.error(`Failed to fetch run details for run ${mostRecentRun.id}`)
          continue
        }

        const runDetail: RunWithGenerations = await runDetailRes.json()

        if (runDetail.generations && runDetail.generations.length > 0) {
          chapterText = runDetail.generations[0].response
        }
      }

      if (chapterText) {
        chapters.push({
          name: capitalize(flow.name),
          content: chapterText,
        })
      }
    }

    if (chapters.length === 0) {
      return NextResponse.json({ detail: 'No content found for completed chapters' }, { status: 404 })
    }

    // Create docx document
    const documentChildren: (Paragraph | Table)[] = []

    // Add document title (collection name)
    documentChildren.push(
      new Paragraph({
        text: collection.name,
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: {
          after: 400, // 20pt spacing after title
        },
      })
    )

    // Add empty line after title
    documentChildren.push(new Paragraph({ text: '' }))

    // Add each chapter
    for (const chapter of chapters) {
      // Add chapter name as Heading 1
      documentChildren.push(
        new Paragraph({
          text: chapter.name,
          heading: HeadingLevel.HEADING_1,
          spacing: {
            before: 400, // 20pt spacing before chapter
            after: 200, // 10pt spacing after chapter heading
          },
        })
      )

      // Convert markdown content to docx paragraphs
      const contentParagraphs = markdownToDocx(chapter.content)
      documentChildren.push(...contentParagraphs)

      // Add spacing between chapters
      documentChildren.push(new Paragraph({ text: '' }))
    }

    const doc = new Document({
      sections: [
        {
          children: documentChildren,
        },
      ],
    })

    // Generate the docx file
    const buffer = await Packer.toBuffer(doc)

    // Create filename with date
    const date = new Date().toISOString().split('T')[0]
    const filename = `${collection.name.replace(/[^a-z0-9]/gi, '_')}_${date}.docx`

    // Return the file
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err: any) {
    const errorMessage = err.message ?? 'Route error'
    console.error('Error in GET /api/collections/[collection_id]/export:', errorMessage, err)
    return NextResponse.json(
      { detail: `Fout bij genereren van export: ${errorMessage}` },
      { status: 500 }
    )
  }
}
