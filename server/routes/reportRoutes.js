import { Router } from "express";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { getReportCatalog, getReportFilters, queryReport } from "../services/reportService.js";

function safeName(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function csvValue(value) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function filtersLabel(filters) {
  return Object.entries(filters).filter(([, value]) => value).map(([key, value]) => `${key}: ${value}`).join(" | ") || "All records";
}

const PDF_ROWS_PER_PAGE = 50;
const PDF_MARGIN = 36;
const PDF_HEADER_HEIGHT = 72;
const PDF_FOOTER_HEIGHT = 24;
const PDF_CELL_PADDING = 4;
const PDF_FONT_SIZE = 9;
const PDF_LINE_HEIGHT = 12;
const PDF_MIN_WIDTH = 1190;

function formatPrintedDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function pdfText(value) {
  return value == null ? "" : String(value);
}

function getPdfColumnWidths(columns, rows) {
  const widths = columns.map((column) => {
    const longestValue = rows.reduce((longest, row) => Math.max(longest, pdfText(row[column]).length), pdfText(column).length);
    return Math.max(72, Math.min(240, longestValue * 4.5 + PDF_CELL_PADDING * 2));
  });
  const contentWidth = widths.reduce((total, width) => total + width, 0);
  const pageWidth = Math.max(PDF_MIN_WIDTH, contentWidth + PDF_MARGIN * 2);
  return { widths, pageWidth };
}

function getPdfRowHeight(row, columns, widths) {
  const lineCount = columns.reduce((largest, column, index) => {
    const availableWidth = Math.max(widths[index] - PDF_CELL_PADDING * 2, 1);
    const charactersPerLine = Math.max(Math.floor(availableWidth / (PDF_FONT_SIZE * 0.52)), 1);
    return Math.max(largest, Math.ceil(pdfText(row[column]).length / charactersPerLine));
  }, 1);
  return Math.max(PDF_LINE_HEIGHT, lineCount * PDF_LINE_HEIGHT + 4);
}

function getPdfPageHeight(rows, columns, widths) {
  const rowsHeight = rows.reduce((total, row) => total + getPdfRowHeight(row, columns, widths), 0);
  return PDF_MARGIN + PDF_HEADER_HEIGHT + rowsHeight + PDF_FOOTER_HEIGHT + PDF_MARGIN;
}

function createExportRoutes() {
  const router = Router();

  router.get("/catalog", (request, response) => response.json({ reports: getReportCatalog() }));
  router.get("/filters", async (request, response, next) => {
    try {
      response.json(await getReportFilters());
    } catch (error) {
      next(error);
    }
  });

  router.get("/:reportId/export.csv", async (request, response, next) => {
    try {
      const result = await queryReport(request.params.reportId, request.query);
      const lines = [result.columns.map(csvValue).join(","), ...result.rows.map((row) => result.columns.map((column) => csvValue(row[column])).join(","))];
      response.setHeader("Content-Type", "text/csv; charset=utf-8");
      response.setHeader("Content-Disposition", `attachment; filename="${safeName(result.name)}.csv"`);
      response.send(`\uFEFF${lines.join("\n")}`);
    } catch (error) {
      next(error);
    }
  });

  router.get("/:reportId/export.xlsx", async (request, response, next) => {
    try {
      const result = await queryReport(request.params.reportId, request.query);
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet(result.name.slice(0, 31));
      sheet.addRow([result.name]);
      sheet.addRow([]);
      sheet.addRow(result.columns);
      result.rows.forEach((row) => sheet.addRow(result.columns.map((column) => row[column])));
      sheet.getRow(1).font = { bold: true, size: 16 };
      sheet.getRow(3).font = { bold: true };
      sheet.columns.forEach((column) => { column.width = 20; });
      response.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      response.setHeader("Content-Disposition", `attachment; filename="${safeName(result.name)}.xlsx"`);
      await workbook.xlsx.write(response);
      response.end();
    } catch (error) {
      next(error);
    }
  });

  router.get("/:reportId/export.pdf", async (request, response, next) => {
    try {
      const result = await queryReport(request.params.reportId, request.query);
      const userName = `${request.user.firstName} ${request.user.lastName}`;
      const pages = [];
      for (let index = 0; index < result.rows.length; index += PDF_ROWS_PER_PAGE) {
        pages.push(result.rows.slice(index, index + PDF_ROWS_PER_PAGE));
      }
      if (!pages.length) pages.push([]);

      const { widths, pageWidth } = getPdfColumnWidths(result.columns, result.rows);
      const pageHeights = pages.map((pageRows) => getPdfPageHeight(pageRows, result.columns, widths));
      const document = new PDFDocument({
        margin: PDF_MARGIN,
        size: [pageWidth, pageHeights[0]],
        autoFirstPage: false,
      });
      response.setHeader("Content-Type", "application/pdf");
      response.setHeader("Content-Disposition", `attachment; filename="${safeName(result.name)}.pdf"`);
      document.pipe(response);

      const drawHeader = () => {
        const contentWidth = pageWidth - PDF_MARGIN * 2;
        const metadataWidth = Math.min(220, contentWidth * 0.3);
        const metadataX = pageWidth - PDF_MARGIN - metadataWidth;

        document.fillColor("#000000").font("Helvetica").fontSize(11)
          .text("West Kenya Sugar Company Limited", PDF_MARGIN, 24, { width: contentWidth, align: "center" });
        document.fontSize(14)
          .text(result.name, PDF_MARGIN, 41, { width: contentWidth, align: "center" });
        document.fontSize(8)
          .text(`Printed on: ${formatPrintedDate()}`, metadataX, 24, { width: metadataWidth, align: "right" })
          .text(`Printed by: ${userName}`, metadataX, 39, { width: metadataWidth, align: "right" });
      };

      const drawFooter = () => {
        const pageNumber = document.page.number;
        const footerY = document.page.height - PDF_MARGIN - PDF_FOOTER_HEIGHT + 5;

        document.font("Helvetica").fontSize(8).fillColor("#000000")
          .text(`Page ${pageNumber} of ${pages.length}`, PDF_MARGIN, footerY, { width: pageWidth - PDF_MARGIN * 2, align: "center" });
      };

      pages.forEach((pageRows, pageIndex) => {
        document.addPage({ size: [pageWidth, pageHeights[pageIndex]], margin: PDF_MARGIN });
        drawHeader();

        let y = PDF_MARGIN + PDF_HEADER_HEIGHT;
        const headerRow = Object.fromEntries(result.columns.map((column) => [column, column]));
        const headerHeight = getPdfRowHeight(headerRow, result.columns, widths);
        const drawRow = (row, rowHeight) => {
          let x = PDF_MARGIN;
          document.font("Helvetica").fontSize(PDF_FONT_SIZE).fillColor("#000000");
          result.columns.forEach((column, index) => {
            document.rect(x, y, widths[index], rowHeight).strokeColor("#000000").stroke();
            document.text(pdfText(row[column]), x + PDF_CELL_PADDING, y + PDF_CELL_PADDING, {
              width: widths[index] - PDF_CELL_PADDING * 2,
              height: rowHeight - PDF_CELL_PADDING,
              lineBreak: true,
              ellipsis: false,
            });
            x += widths[index];
          });
          y += rowHeight;
        };

        drawRow(headerRow, headerHeight);
        pageRows.forEach((row) => drawRow(row, getPdfRowHeight(row, result.columns, widths)));
        drawFooter();
      });

      document.end();
    } catch (error) {
      next(error);
    }
  });

  router.get("/:reportId", async (request, response, next) => {
    try {
      response.json(await queryReport(request.params.reportId, request.query));
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export default createExportRoutes;