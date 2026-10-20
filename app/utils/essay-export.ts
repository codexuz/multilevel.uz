/**
 * A guest's Writing as a file to keep: each task's question and the candidate's text with its word
 * count, as PDF or Word. Built in the browser; nothing is sent anywhere. The libraries load only
 * when a file is asked for.
 */
export interface EssayForExport { label: string, prompt: string, text: string, wordCount: number, minWords?: number | null }

const plain = (html: string) => html
  .replace(/<\/(p|li|h\d|tr)>/gi, '\n')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<li[^>]*>/gi, '• ')
  .replace(/<[^>]*>/g, '')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/\n{3,}/g, '\n\n')
  .trim()

const fileName = (title: string, ext: string) => `${title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'writing'}-writing.${ext}`

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export async function downloadEssaysPdf(title: string, essays: EssayForExport[]) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const margin = 56
  const width = doc.internal.pageSize.getWidth() - margin * 2
  const bottom = doc.internal.pageSize.getHeight() - margin
  let y = margin

  const write = (text: string, size: number, style: 'normal' | 'bold' | 'italic' = 'normal', gap = 6) => {
    doc.setFont('helvetica', style)
    doc.setFontSize(size)
    for (const line of doc.splitTextToSize(text, width) as string[]) {
      if (y + size > bottom) {
        doc.addPage()
        y = margin
      }
      doc.text(line, margin, y + size)
      y += size * 1.35
    }
    y += gap
  }

  write(title, 18, 'bold', 4)
  write(`Multilevel Writing — ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`, 10, 'italic', 14)
  essays.forEach((essay, i) => {
    if (i > 0) y += 12
    write(essay.label, 14, 'bold', 4)
    write(plain(essay.prompt), 10, 'italic', 8)
    write(essay.text.trim() || '(not written)', 11, 'normal', 4)
    write(`${essay.wordCount} words${essay.minWords ? ` (at least ${essay.minWords} expected)` : ''}`, 9, 'italic', 8)
  })
  save(doc.output('blob'), fileName(title, 'pdf'))
}

export async function downloadEssaysDocx(title: string, essays: EssayForExport[]) {
  const { Document, HeadingLevel, Packer, Paragraph, TextRun } = await import('docx')
  const lines = (text: string, run: (t: string) => InstanceType<typeof TextRun>) =>
    text.split('\n').map(line => new Paragraph({ children: [run(line)], spacing: { after: 120 } }))
  const children = [
    new Paragraph({ text: title, heading: HeadingLevel.TITLE }),
    new Paragraph({ children: [new TextRun({ text: 'Multilevel Writing', italics: true })], spacing: { after: 240 } })
  ]
  for (const essay of essays) {
    children.push(new Paragraph({ text: essay.label, heading: HeadingLevel.HEADING_1, spacing: { before: 240 } }))
    children.push(...lines(plain(essay.prompt), t => new TextRun({ text: t, italics: true, size: 20 })))
    children.push(...lines(essay.text.trim() || '(not written)', t => new TextRun({ text: t, size: 24 })))
    children.push(new Paragraph({ children: [new TextRun({ text: `${essay.wordCount} words${essay.minWords ? ` (at least ${essay.minWords} expected)` : ''}`, italics: true, size: 18 })] }))
  }
  const blob = await Packer.toBlob(new Document({ creator: 'multilevel.uz', title, sections: [{ children }] }))
  save(blob, fileName(title, 'docx'))
}
