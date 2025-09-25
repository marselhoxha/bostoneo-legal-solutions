import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { AiResponseFormatterPipe } from '../../ai-response-formatter.pipe';
import { ClipboardModule, ClipboardService } from 'ngx-clipboard';
import jsPDF from 'jspdf';

@Component({
  selector: 'app-ai-response-modal',
  standalone: true,
  imports: [CommonModule, AiResponseFormatterPipe, ClipboardModule],
  templateUrl: './ai-response-modal.component.html',
  styleUrls: ['./ai-response-modal.component.scss']
})
export class AiResponseModalComponent {
  @Input() title: string = 'AI Analysis';
  @Input() content: string = '';
  @Input() contextInfo?: any;

  copySuccess: boolean = false;

  constructor(
    public activeModal: NgbActiveModal,
    private clipboardService: ClipboardService
  ) {}

  copyToClipboard(): void {
    // Strip HTML tags for plain text copy
    const plainText = this.content
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"');

    this.clipboardService.copy(plainText);
    this.copySuccess = true;

    setTimeout(() => {
      this.copySuccess = false;
    }, 2000);
  }

  exportAsPDF(): void {
    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    const leftMargin = 25;
    const rightMargin = 25;
    const topMargin = 25;
    const bottomMargin = 25;
    const contentWidth = pageWidth - leftMargin - rightMargin;
    const lineHeight = 6;
    const paragraphSpacing = 8;
    let currentY = topMargin;

    // Helper function to add page number
    const addPageNumber = (pageNum: number) => {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Page ${pageNum}`, pageWidth / 2, pageHeight - 15, { align: 'center' });
    };

    // Helper function to check and add new page if needed
    const checkNewPage = (requiredSpace: number, pageNum: { value: number }) => {
      if (currentY + requiredSpace > pageHeight - bottomMargin) {
        addPageNumber(pageNum.value);
        doc.addPage();
        pageNum.value++;
        currentY = topMargin;
      }
    };

    let pageNumber = { value: 1 };

    // Document Header - Centered Title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    const titleLines = doc.splitTextToSize(this.title.toUpperCase(), contentWidth);
    titleLines.forEach(line => {
      doc.text(line, pageWidth / 2, currentY, { align: 'center' });
      currentY += 8;
    });
    currentY += 5;

    // Add a horizontal line
    doc.setLineWidth(0.5);
    doc.line(leftMargin, currentY, pageWidth - rightMargin, currentY);
    currentY += 10;

    // Document metadata
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date Generated: ${new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })}`, leftMargin, currentY);
    currentY += 6;
    doc.text(`Time: ${new Date().toLocaleTimeString('en-US')}`, leftMargin, currentY);
    currentY += 12;

    // Case Information Section
    if (this.contextInfo) {
      checkNewPage(30, pageNumber);

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('CASE INFORMATION', leftMargin, currentY);
      currentY += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');

      Object.entries(this.contextInfo).forEach(([key, value]) => {
        const formattedKey = key.replace(/([A-Z])/g, ' $1').trim();
        const text = `${formattedKey}:`;
        const valueText = String(value);

        // Key in bold
        doc.setFont('helvetica', 'bold');
        doc.text(text, leftMargin, currentY);

        // Value in normal
        doc.setFont('helvetica', 'normal');
        const valueLines = doc.splitTextToSize(valueText, contentWidth - 10);

        checkNewPage(valueLines.length * lineHeight, pageNumber);

        valueLines.forEach((line, index) => {
          if (index === 0) {
            doc.text(line, leftMargin + doc.getTextWidth(text + ' '), currentY);
          } else {
            currentY += lineHeight;
            doc.text(line, leftMargin + 10, currentY);
          }
        });
        currentY += 8;
      });

      // Add separator line
      currentY += 5;
      doc.setLineWidth(0.3);
      doc.line(leftMargin, currentY, pageWidth - rightMargin, currentY);
      currentY += 10;
    }

    // Main Content - Process and format legal document style
    const plainText = this.content
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\\n/g, '\n');

    // Process content sections with proper formatting
    const lines = plainText.split('\n');
    let inList = false;
    let listNumber = 1;

    doc.setFontSize(11);

    lines.forEach(line => {
      const trimmedLine = line.trim();

      if (!trimmedLine) {
        currentY += paragraphSpacing;
        inList = false;
        listNumber = 1;
        return;
      }

      checkNewPage(20, pageNumber);

      // Handle markdown headers - convert to legal document sections
      if (trimmedLine.startsWith('###')) {
        const headerText = trimmedLine.replace(/^###\s*/, '').toUpperCase();
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);

        const headerLines = doc.splitTextToSize(headerText, contentWidth);
        headerLines.forEach(headerLine => {
          doc.text(headerLine, leftMargin, currentY);
          currentY += lineHeight + 1;
        });
        currentY += 4;
        doc.setFont('helvetica', 'normal');

      } else if (trimmedLine.startsWith('##')) {
        const headerText = trimmedLine.replace(/^##\s*/, '');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);

        currentY += 3;
        const headerLines = doc.splitTextToSize(headerText.toUpperCase(), contentWidth);
        headerLines.forEach(headerLine => {
          doc.text(headerLine, leftMargin, currentY);
          currentY += lineHeight + 2;
        });
        currentY += 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);

      } else if (trimmedLine.startsWith('#')) {
        const headerText = trimmedLine.replace(/^#\s*/, '');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);

        currentY += 5;
        const headerLines = doc.splitTextToSize(headerText.toUpperCase(), contentWidth);
        headerLines.forEach(headerLine => {
          doc.text(headerLine, leftMargin, currentY);
          currentY += lineHeight + 3;
        });
        currentY += 6;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);

      } else if (trimmedLine.match(/^\d+\.\s+/)) {
        // Numbered list
        const listText = trimmedLine.replace(/^\d+\.\s+/, '');
        const number = trimmedLine.match(/^(\d+)\./)[1];

        doc.setFont('helvetica', 'normal');
        const textLines = doc.splitTextToSize(listText, contentWidth - 15);

        checkNewPage(textLines.length * lineHeight, pageNumber);

        doc.text(`${number}.`, leftMargin, currentY);
        textLines.forEach((textLine, index) => {
          if (index === 0) {
            doc.text(textLine, leftMargin + 10, currentY);
          } else {
            currentY += lineHeight;
            doc.text(textLine, leftMargin + 10, currentY);
          }
        });
        currentY += lineHeight + 2;
        inList = true;

      } else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('• ')) {
        // Bullet points
        const bulletText = trimmedLine.replace(/^[-•]\s+/, '');

        doc.setFont('helvetica', 'normal');
        const textLines = doc.splitTextToSize(bulletText, contentWidth - 15);

        checkNewPage(textLines.length * lineHeight, pageNumber);

        doc.text('•', leftMargin + 3, currentY);
        textLines.forEach((textLine, index) => {
          if (index === 0) {
            doc.text(textLine, leftMargin + 10, currentY);
          } else {
            currentY += lineHeight;
            doc.text(textLine, leftMargin + 10, currentY);
          }
        });
        currentY += lineHeight + 2;
        inList = true;

      } else if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
        // Bold text
        const boldText = trimmedLine.replace(/\*\*/g, '');
        doc.setFont('helvetica', 'bold');
        const textLines = doc.splitTextToSize(boldText, contentWidth);

        checkNewPage(textLines.length * lineHeight, pageNumber);

        textLines.forEach(textLine => {
          doc.text(textLine, leftMargin, currentY);
          currentY += lineHeight;
        });
        currentY += 2;
        doc.setFont('helvetica', 'normal');

      } else {
        // Regular paragraph
        doc.setFont('helvetica', 'normal');
        const textLines = doc.splitTextToSize(trimmedLine, contentWidth);

        checkNewPage(textLines.length * lineHeight, pageNumber);

        textLines.forEach(textLine => {
          doc.text(textLine, leftMargin, currentY);
          currentY += lineHeight;
        });

        if (!inList) {
          currentY += 3;
        }
      }
    });

    // Add final page number
    addPageNumber(pageNumber.value);

    // Save the PDF with a professional filename
    const fileName = `${this.title.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  }

  print(): void {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      // Process content to remove markdown and format properly
      let processedContent = this.content
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"');

      // Convert markdown to HTML with legal document styling
      processedContent = processedContent
        // Headers
        .replace(/^###\s+(.+)$/gm, '<h3 class="section-header">$1</h3>')
        .replace(/^##\s+(.+)$/gm, '<h2 class="major-header">$1</h2>')
        .replace(/^#\s+(.+)$/gm, '<h1 class="main-header">$1</h1>')
        // Bold text
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        // Lists
        .replace(/^\d+\.\s+(.+)$/gm, '<li class="numbered">$1</li>')
        .replace(/^[-•]\s+(.+)$/gm, '<li class="bullet">$1</li>')
        // Line breaks
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br/>');

      // Wrap in paragraph tags if not already
      if (!processedContent.startsWith('<')) {
        processedContent = '<p>' + processedContent + '</p>';
      }

      // Format case information
      let caseInfoHtml = '';
      if (this.contextInfo) {
        caseInfoHtml = `
          <div class="case-info">
            <h2 class="info-header">CASE INFORMATION</h2>
            <table class="info-table">`;

        Object.entries(this.contextInfo).forEach(([key, value]) => {
          const formattedKey = key.replace(/([A-Z])/g, ' $1').trim();
          caseInfoHtml += `
            <tr>
              <td class="info-key">${formattedKey}:</td>
              <td class="info-value">${value}</td>
            </tr>`;
        });

        caseInfoHtml += `
            </table>
          </div>
          <hr class="section-divider"/>`;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${this.title}</title>
            <style>
              @page {
                size: letter;
                margin: 1in;
              }

              @media print {
                body {
                  margin: 0;
                }
              }

              body {
                font-family: 'Times New Roman', Times, serif;
                font-size: 12pt;
                line-height: 1.6;
                color: #000;
                background: white;
                padding: 0;
                margin: 0;
              }

              .document-header {
                text-align: center;
                margin-bottom: 30px;
                border-bottom: 2px solid #000;
                padding-bottom: 20px;
              }

              .document-title {
                font-size: 16pt;
                font-weight: bold;
                text-transform: uppercase;
                margin: 0 0 10px 0;
                letter-spacing: 1px;
              }

              .document-meta {
                font-size: 10pt;
                color: #333;
                margin: 5px 0;
              }

              .case-info {
                margin: 20px 0;
              }

              .info-header {
                font-size: 14pt;
                font-weight: bold;
                margin: 20px 0 15px 0;
                text-transform: uppercase;
              }

              .info-table {
                width: 100%;
                margin-bottom: 20px;
              }

              .info-key {
                font-weight: bold;
                vertical-align: top;
                padding: 5px 10px 5px 0;
                width: 30%;
              }

              .info-value {
                vertical-align: top;
                padding: 5px 0;
              }

              .section-divider {
                border: none;
                border-top: 1px solid #666;
                margin: 20px 0;
              }

              .main-header {
                font-size: 14pt;
                font-weight: bold;
                text-transform: uppercase;
                margin: 25px 0 15px 0;
                page-break-after: avoid;
              }

              .major-header {
                font-size: 13pt;
                font-weight: bold;
                text-transform: uppercase;
                margin: 20px 0 12px 0;
                page-break-after: avoid;
              }

              .section-header {
                font-size: 12pt;
                font-weight: bold;
                margin: 15px 0 10px 0;
                page-break-after: avoid;
              }

              p {
                margin: 0 0 12px 0;
                text-align: justify;
                text-indent: 0.5in;
                page-break-inside: avoid;
              }

              p:first-of-type {
                text-indent: 0;
              }

              li {
                margin: 8px 0;
                list-style: none;
                page-break-inside: avoid;
              }

              li.numbered {
                counter-increment: list-counter;
                padding-left: 30px;
                position: relative;
              }

              li.numbered::before {
                content: counter(list-counter) ".";
                position: absolute;
                left: 0;
                font-weight: bold;
              }

              li.bullet {
                padding-left: 30px;
                position: relative;
              }

              li.bullet::before {
                content: "•";
                position: absolute;
                left: 10px;
              }

              ol, ul {
                counter-reset: list-counter;
                margin: 0;
                padding: 0;
              }

              strong {
                font-weight: bold;
              }

              .page-break {
                page-break-after: always;
              }

              @media print {
                .no-print {
                  display: none;
                }
              }
            </style>
          </head>
          <body>
            <div class="document-header">
              <h1 class="document-title">${this.title}</h1>
              <div class="document-meta">Date Generated: ${new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}</div>
              <div class="document-meta">Time: ${new Date().toLocaleTimeString('en-US')}</div>
            </div>

            ${caseInfoHtml}

            <div class="document-content">
              ${processedContent}
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();

      // Wait for content to load before printing
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  }

  close(): void {
    this.activeModal.dismiss();
  }
}