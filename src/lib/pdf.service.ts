import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { Decimal } from '@prisma/client/runtime/library'

interface LineItem {
  date: Date
  userName: string
  taskTitle: string
  hours: Decimal
  hourlyRate: Decimal
  description: string | null
}

interface InvoiceData {
  invoiceNumber: string
  clientName: string
  clientContactPerson: string
  projectName?: string | null
  periodStart: Date
  periodEnd: Date
  hourlyRate: Decimal
  totalHours: Decimal
  totalAmount: Decimal
  notes?: string | null
  lineItems: LineItem[]
}

function fmt(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtBDT(amount: Decimal | number): string {
  return `৳${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export async function generateInvoicePdf(invoice: InvoiceData): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([595, 842]) // A4
  const { width, height } = page.getSize()

  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold)
  const regularFont = await doc.embedFont(StandardFonts.Helvetica)

  const primary = rgb(0.12, 0.47, 0.71)
  const black = rgb(0, 0, 0)
  const gray = rgb(0.5, 0.5, 0.5)
  const lightGray = rgb(0.95, 0.95, 0.95)

  let y = height - 50

  // Header
  page.drawRectangle({ x: 0, y: y - 10, width, height: 70, color: primary })
  page.drawText('DataFever Technology', { x: 40, y: y + 20, size: 20, font: boldFont, color: rgb(1, 1, 1) })
  page.drawText('Invoice', { x: width - 120, y: y + 20, size: 20, font: boldFont, color: rgb(1, 1, 1) })
  page.drawText(invoice.invoiceNumber, { x: width - 150, y: y + 2, size: 11, font: regularFont, color: rgb(0.9, 0.9, 0.9) })

  y -= 60

  // Client + period info
  page.drawText('Bill To:', { x: 40, y, size: 9, font: boldFont, color: gray })
  page.drawText(`Generated: ${fmt(new Date())}`, { x: width - 200, y, size: 9, font: regularFont, color: gray })
  y -= 15
  page.drawText(invoice.clientName, { x: 40, y, size: 12, font: boldFont, color: black })
  page.drawText('Period:', { x: width - 200, y, size: 9, font: boldFont, color: gray })
  y -= 14
  page.drawText(invoice.clientContactPerson, { x: 40, y, size: 10, font: regularFont, color: black })
  page.drawText(`${fmt(invoice.periodStart)} – ${fmt(invoice.periodEnd)}`, { x: width - 200, y, size: 10, font: regularFont, color: black })
  y -= 14
  if (invoice.projectName) {
    page.drawText(`Project: ${invoice.projectName}`, { x: 40, y, size: 10, font: regularFont, color: gray })
  }
  page.drawText(`Hourly Rate: ${fmtBDT(invoice.hourlyRate)}`, { x: width - 200, y, size: 10, font: regularFont, color: black })

  y -= 30

  // Table header
  const colX = [40, 100, 220, 330, 400, 470]
  const headers = ['Date', 'Member', 'Task', 'Hours', 'Rate', 'Amount']
  page.drawRectangle({ x: 35, y: y - 5, width: width - 70, height: 20, color: primary })
  headers.forEach((h, i) => {
    page.drawText(h, { x: colX[i], y: y + 2, size: 9, font: boldFont, color: rgb(1, 1, 1) })
  })
  y -= 18

  // Line items
  let altRow = false
  for (const item of invoice.lineItems) {
    if (y < 100) {
      // Simple overflow guard — add new page if needed
      const newPage = doc.addPage([595, 842])
      y = 800
      // (In a full implementation, repeat headers on new page)
    }
    if (altRow) {
      page.drawRectangle({ x: 35, y: y - 4, width: width - 70, height: 16, color: lightGray })
    }
    const amount = Number(item.hours) * Number(invoice.hourlyRate)
    const row = [
      fmt(item.date),
      item.userName.substring(0, 14),
      item.taskTitle.substring(0, 20),
      Number(item.hours).toFixed(2),
      fmtBDT(invoice.hourlyRate),
      fmtBDT(amount),
    ]
    row.forEach((cell, i) => {
      page.drawText(cell, { x: colX[i], y: y - 2, size: 8, font: regularFont, color: black })
    })
    y -= 16
    altRow = !altRow
  }

  // Totals row
  y -= 8
  page.drawRectangle({ x: 35, y: y - 5, width: width - 70, height: 20, color: rgb(0.2, 0.2, 0.2) })
  page.drawText('TOTAL', { x: 40, y: y + 2, size: 9, font: boldFont, color: rgb(1, 1, 1) })
  page.drawText(`${Number(invoice.totalHours).toFixed(2)} hrs`, { x: colX[3], y: y + 2, size: 9, font: boldFont, color: rgb(1, 1, 1) })
  page.drawText(fmtBDT(invoice.totalAmount), { x: colX[5], y: y + 2, size: 9, font: boldFont, color: rgb(1, 1, 1) })
  y -= 30

  // Notes
  if (invoice.notes) {
    page.drawText('Notes:', { x: 40, y, size: 9, font: boldFont, color: gray })
    y -= 14
    page.drawText(invoice.notes.substring(0, 200), { x: 40, y, size: 9, font: regularFont, color: black, maxWidth: width - 80 })
    y -= 20
  }

  // Footer
  page.drawLine({ start: { x: 40, y: 50 }, end: { x: width - 40, y: 50 }, thickness: 0.5, color: gray })
  page.drawText('Thank you for your business — DataFever Technology', {
    x: 40, y: 35, size: 9, font: regularFont, color: gray,
  })

  return doc.save()
}
