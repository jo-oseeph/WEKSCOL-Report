import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import {
  getReportFilters,
  queryReport,
} from "../services/reportService.js";
import { getHarvestingFilters } from "../modules/agriculture/harvesting/harvestingReportService.js";
import { getFlatReportCatalog, getReportModuleCatalog } from "../modules/index.js";

function safeName(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function csvValue(value) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const PDF_MARGIN = 36;
const PDF_HEADER_HEIGHT = 84;
const PDF_PAGE_HEIGHT = 842;
const PDF_CELL_PADDING = 4;
const PDF_FONT_SIZE = 9;
const PDF_LINE_HEIGHT = 12;
const PDF_MIN_WIDTH = 1190;

function formatPrintedDate(date = new Date()) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = date.toLocaleString("en-US", { month: "short" });
  return `${day}-${month}-${date.getFullYear()}`;
}

function pdfText(value) {
  return value == null ? "" : String(value);
}

function getPdfColumnWidths(columns, rows) {
  const widths = columns.map((column) => {
    const longestValue = rows.reduce(
      (longest, row) => Math.max(longest, pdfText(row[column]).length),
      pdfText(column).length,
    );
    return Math.max(
      72,
      Math.min(240, longestValue * 4.5 + PDF_CELL_PADDING * 2),
    );
  });
  const contentWidth = widths.reduce((total, width) => total + width, 0);
  const pageWidth = Math.max(PDF_MIN_WIDTH, contentWidth + PDF_MARGIN * 2);
  return { widths, pageWidth };
}

function getPdfRowHeight(row, columns, widths) {
  const lineCount = columns.reduce((largest, column, index) => {
    const availableWidth = Math.max(widths[index] - PDF_CELL_PADDING * 2, 1);
    const charactersPerLine = Math.max(
      Math.floor(availableWidth / (PDF_FONT_SIZE * 0.52)),
      1,
    );
    return Math.max(
      largest,
      Math.ceil(pdfText(row[column]).length / charactersPerLine),
    );
  }, 1);
  return Math.max(PDF_LINE_HEIGHT, lineCount * PDF_LINE_HEIGHT + 4);
}

function splitPdfRows(rows, columns, widths, headerHeight) {
  const tableHeightAvailable =
    PDF_PAGE_HEIGHT - PDF_MARGIN * 2 - PDF_HEADER_HEIGHT;
  const pages = [];
  let pageRows = [];
  let pageRowsHeight = headerHeight;

  rows.forEach((row) => {
    const rowHeight = getPdfRowHeight(row, columns, widths);
    if (
      pageRows.length > 0 &&
      pageRowsHeight + rowHeight > tableHeightAvailable
    ) {
      pages.push(pageRows);
      pageRows = [];
      pageRowsHeight = headerHeight;
    }
    pageRows.push(row);
    pageRowsHeight += rowHeight;
  });

  if (pageRows.length || pages.length === 0) pages.push(pageRows);
  return pages;
}

const createReportController = () => {
  const logoPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../client/public/images/logo1.png",
  );

  return {
    // Returns the available report categories and report definitions.
    catalog(request, response, next) {
      try {
        response.json({
          categories: getReportModuleCatalog(),
          reports: getFlatReportCatalog(),
        });
      } catch (error) {
        next(error);
      }
    },
    // Returns filter values for the requested report source.
    async filters(request, response, next) {
    try {
      response.json(
        request.query.source === "harvesting"
          ? await getHarvestingFilters()
          : await getReportFilters(),
      );
    } catch (error) {
      next(error);
    }
    },

    // Streams the requested report as a CSV download.
    async exportCsv(request, response, next) {
    try {
      const result = await queryReport(request.params.reportId, request.query);
      const lines = [
        result.columns.map(csvValue).join(","),
        ...result.rows.map((row) =>
          result.columns.map((column) => csvValue(row[column])).join(","),
        ),
      ];
      response.setHeader("Content-Type", "text/csv; charset=utf-8");
      response.setHeader(
        "Content-Disposition",
        `attachment; filename="${safeName(result.name)}.csv"`,
      );
      response.send(`\uFEFF${lines.join("\n")}`);
    } catch (error) {
      next(error);
    }
    },

    // Streams the requested report as an Excel download.
    async exportXlsx(request, response, next) {
    try {
      const result = await queryReport(request.params.reportId, request.query);
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet(result.name.slice(0, 31));
      sheet.addRow(result.columns);
      result.rows.forEach((row) =>
        sheet.addRow(result.columns.map((column) => row[column])),
      );
      sheet.getRow(1).font = { bold: true };
      sheet.columns.forEach((column) => {
        column.width = 20;
      });
      response.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      response.setHeader(
        "Content-Disposition",
        `attachment; filename="${safeName(result.name)}.xlsx"`,
      );
      await workbook.xlsx.write(response);
      response.end();
    } catch (error) {
      next(error);
    }
    },

    // Streams the requested report as a PDF download.
    async exportPdf(request, response, next) {
    try {
      const result = await queryReport(request.params.reportId, request.query);
      const userName = `${request.user.firstName} ${request.user.lastName}`;
      const { widths, pageWidth } = getPdfColumnWidths(
        result.columns,
        result.rows,
      );
      const headerRow = Object.fromEntries(
        result.columns.map((column) => [column, column]),
      );
      const headerHeight = getPdfRowHeight(headerRow, result.columns, widths);
      const pages = splitPdfRows(
        result.rows,
        result.columns,
        widths,
        headerHeight,
      );
      const document = new PDFDocument({
        margin: PDF_MARGIN,
        size: [pageWidth, PDF_PAGE_HEIGHT],
        autoFirstPage: false,
      });
      response.setHeader("Content-Type", "application/pdf");
      response.setHeader(
        "Content-Disposition",
        `attachment; filename="${safeName(result.name)}.pdf"`,
      );
      document.pipe(response);

      const tableWidth = widths.reduce((total, width) => total + width, 0);
      const tableX = (pageWidth - tableWidth) / 2;
      const drawHeader = (pageNumber, totalPages) => {
        const headerY = PDF_MARGIN;
        const metadataWidth = Math.min(280, tableWidth * 0.32);
        const metadataX = tableX + tableWidth - metadataWidth - 10;
        const logoWidth = Math.min(86, tableWidth * 0.12);
        const detailsX = tableX + logoWidth + 14;
        const detailsWidth = Math.max(180, metadataX - detailsX - 14);

        document
          .rect(tableX, headerY, tableWidth, PDF_HEADER_HEIGHT)
          .lineWidth(1)
          .strokeColor("#000000")
          .stroke();
        document.image(logoPath, tableX + 10, headerY + 8, {
          fit: [logoWidth, PDF_HEADER_HEIGHT - 16],
          align: "center",
          valign: "center",
        });

        document
          .fillColor("#000000")
          .font("Helvetica-Bold")
          .fontSize(11)
          .text("West Kenya Sugar Company Limited", detailsX, headerY + 7, {
            width: detailsWidth,
            align: "left",
          });
        document
          .font("Helvetica-Bold")
          .fontSize(10)
          .text(result.name, detailsX, headerY + 28, {
            width: detailsWidth,
            align: "left",
          });

        document
          .font("Helvetica")
          .fontSize(8)
          .text(
            `Printed On:    ${formatPrintedDate()}`,
            metadataX,
            headerY + 8,
            { width: metadataWidth, align: "left" },
          )
          .text(
            `Page No.:      Page ${pageNumber} of ${totalPages}`,
            metadataX,
            headerY + 25,
            { width: metadataWidth, align: "left" },
          )
          .fillColor("#666666")
          .text(`Printed By: ${userName}`, metadataX, headerY + 42, {
            width: metadataWidth,
            align: "left",
          });
      };

      pages.forEach((pageRows, pageIndex) => {
        document.addPage({
          size: [pageWidth, PDF_PAGE_HEIGHT],
          margin: PDF_MARGIN,
        });
        drawHeader(pageIndex + 1, pages.length);

        let y = PDF_MARGIN + PDF_HEADER_HEIGHT;
        const drawRow = (row, rowHeight) => {
          let x = tableX;
          document
            .font("Helvetica")
            .fontSize(PDF_FONT_SIZE)
            .fillColor("#000000");
          result.columns.forEach((column, index) => {
            document
              .rect(x, y, widths[index], rowHeight)
              .strokeColor("#000000")
              .stroke();
            document.text(
              pdfText(row[column]),
              x + PDF_CELL_PADDING,
              y + PDF_CELL_PADDING,
              {
                width: widths[index] - PDF_CELL_PADDING * 2,
                height: rowHeight - PDF_CELL_PADDING,
                lineBreak: true,
                ellipsis: false,
              },
            );
            x += widths[index];
          });
          y += rowHeight;
        };

        drawRow(headerRow, headerHeight);
        pageRows.forEach((row) =>
          drawRow(row, getPdfRowHeight(row, result.columns, widths)),
        );
      });

      document.end();
    } catch (error) {
      next(error);
    }
    },

    // Executes a report and returns its tabular result as JSON.
    async run(request, response, next) {
    try {
      response.json(await queryReport(request.params.reportId, request.query));
    } catch (error) {
      next(error);
    }
    },
  };
};

export default createReportController;


