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
      sheet.addRow([`Downloaded by: ${request.user.firstName} ${request.user.lastName}`]);
      sheet.addRow([filtersLabel(result.filters)]);
      sheet.addRow([]);
      sheet.addRow(result.columns);
      result.rows.forEach((row) => sheet.addRow(result.columns.map((column) => row[column])));
      sheet.getRow(1).font = { bold: true, size: 16 };
      sheet.getRow(5).font = { bold: true };
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
      const document = new PDFDocument({ margin: 42, size: "A4", layout: "landscape" });
      response.setHeader("Content-Type", "application/pdf");
      response.setHeader("Content-Disposition", `attachment; filename="${safeName(result.name)}.pdf"`);
      document.pipe(response);
      const drawHeader = () => {
        document.fontSize(16).fillColor("#14532d").text(result.name, 42, 28);
        document.fontSize(8).fillColor("#4b5563").text(`Downloaded by: ${userName} | ${filtersLabel(result.filters)}`, 42, 48);
        document.moveTo(42, 64).lineTo(800, 64).strokeColor("#d1d5db").stroke();
      };
      const drawFooter = () => {
        document.fontSize(8).fillColor("#6b7280").text(`WEKSCOL Report • ${result.name} • Page ${document.page.number}`, 42, 560, { align: "center", width: 758 });
      };
      drawHeader();
      let y = 78;
      const widths = result.columns.map(() => 758 / Math.max(result.columns.length, 1));
      const rowHeight = 20;
      const drawRow = (row, header = false) => {
        if (y > 535) {
          drawFooter();
          document.addPage();
          drawHeader();
          y = 78;
        }
        let x = 42;
        document.font(header ? "Helvetica-Bold" : "Helvetica").fontSize(7).fillColor(header ? "#ffffff" : "#111827");
        row.forEach((value, index) => {
          document.rect(x, y, widths[index], rowHeight).fillAndStroke(header ? "#14532d" : (Math.floor((y - 78) / rowHeight) % 2 ? "#f3f4f6" : "#ffffff"), "#d1d5db");
          document.fillColor(header ? "#ffffff" : "#111827").text(value == null ? "" : String(value), x + 4, y + 6, { width: widths[index] - 8, height: rowHeight - 4, ellipsis: true });
          x += widths[index];
        });
        y += rowHeight;
      };
      drawRow(result.columns, true);
      result.rows.forEach((row) => drawRow(result.columns.map((column) => row[column])));
      drawFooter();
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