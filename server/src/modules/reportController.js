import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { performance } from "node:perf_hooks";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadModules } from "./loadModules.js";
import { visibleReportCatalog } from "./reportCatalog.js";
import runReport from "./report-engine/runReport.js";
import createReportResultCache from "./report-engine/reportResultCache.js";
import { cached } from "./report-engine/filtersCache.js";
import { loadInvestmentFilters } from "./agriculture/investment/investment.query.js";
import { loadHarvestingFilters } from "./agriculture/harvesting/harvesting.query.js";
import { loadPlantationFilters } from "./agriculture/plantation/plantation.query.js";
import { loadBillingFilters } from "./agriculture/billing/billing.query.js";

function csv(value) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text)
    ? `"${text.replaceAll('"', '""')}"`
    : text;
}

function fileName(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const logoPath = fileURLToPath(
  new URL("../../../client/public/images/logo1.png", import.meta.url),
);

function displayValue(value) {
  return value == null || value === "" ? "" : String(value);
}

function reportUserName(user) {
  return [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "Unknown user";
}

function drawPdfFooter(document, pageNumber) {
  const { left, right, bottom } = document.page.margins;
  const width = document.page.width - left - right;
  document
    .save()
    .strokeColor("#000000")
    .moveTo(left, document.page.height - bottom - 18)
    .lineTo(document.page.width - right, document.page.height - bottom - 18)
    .stroke()
    .fillColor("#000000")
    .font("Helvetica")
    .fontSize(8)
    .text("West Kenya Sugar Company", left, document.page.height - bottom - 12, {
      width: width / 2,
      lineBreak: false,
    })
    .text(`Page ${pageNumber}`, left + width / 2, document.page.height - bottom - 12, {
      width: width / 2,
      align: "right",
      lineBreak: false,
    })
    .restore();
}

function drawPdfHeading(document, result, user, pageNumber, includeReportDetails = true) {
  const { left, right, top } = document.page.margins;
  const width = document.page.width - left - right;
  const detailsWidth = Math.min(260, width * 0.38);
  const detailsX = document.page.width - right - detailsWidth;
  let headingTop = top;

  if (existsSync(logoPath)) {
    document.image(logoPath, left, headingTop, { fit: [62, 62] });
  }
  document
    .fillColor("#000000")
    .font("Helvetica-Bold")
    .fontSize(16)
    .text("West Kenya Sugar Company", left + 76, headingTop + 8, { width: width - 76 })
    .fillColor("#000000")
    .fontSize(13)
    .text(result.name, left + 76, headingTop + 31, { width: width - 76 });

  if (includeReportDetails) {
    const dateDownloaded = new Date().toISOString().slice(0, 10);
    const details = [
      `Downloaded by: ${reportUserName(user)}`,
      `Date downloaded: ${dateDownloaded}`,
      result.dateRange?.dateFrom || result.dateRange?.dateTo
        ? `Report period: ${result.dateRange.dateFrom || "—"} to ${result.dateRange.dateTo || "—"}`
        : null,
    ].filter(Boolean);
    document
      .fillColor("#000000")
      .font("Helvetica")
      .fontSize(8)
      .text(details.join("\n"), detailsX, headingTop + 5, {
        width: detailsWidth,
        align: "right",
        lineGap: 3,
      });
    headingTop += 91;
  } else {
    headingTop += 72;
  }

  drawPdfFooter(document, pageNumber);
  return headingTop;
}

function drawPdfTableHeader(document, columns, widths, y) {
  const { left } = document.page.margins;
  const padding = 6;
  const height = Math.max(
    25,
    ...columns.map((column, index) => {
      document.font("Helvetica-Bold").fontSize(7.5);
      return document.heightOfString(column, {
        width: widths[index] - padding * 2,
        lineGap: 1,
      }) + padding * 2;
    }),
  );
  let x = left;
  document
    .fillColor("#ffffff")
    .rect(left, y, widths.reduce((sum, width) => sum + width, 0), height)
    .fill()
    .strokeColor("#000000")
    .rect(left, y, widths.reduce((sum, width) => sum + width, 0), height)
    .stroke();
  columns.forEach((column, index) => {
    document
      .fillColor("#000000")
      .font("Helvetica-Bold")
      .fontSize(7.5)
      .text(column, x + padding, y + padding, {
        width: widths[index] - padding * 2,
        lineGap: 1,
      });
    document
      .strokeColor("#000000")
      .rect(x, y, widths[index], height)
      .stroke();
    x += widths[index];
  });
  return y + height;
}

function pdfColumnWidths(document, columns, rows) {
  const { left, right } = document.page.margins;
  const available = document.page.width - left - right;
  const natural = columns.map((column) => {
    const longest = Math.max(
      column.length,
      ...rows.slice(0, 100).map((row) => displayValue(row[column]).length),
    );
    return Math.min(180, Math.max(58, longest * 4.25 + 14));
  });
  const total = natural.reduce((sum, width) => sum + width, 0);
  if (total <= available) return natural;
  const scale = available / total;
  return natural.map((width) => Math.max(48, width * scale));
}

function writePdf(document, result, user) {
  const isWide = result.columns.length > 8;
  const pageSize = isWide ? "A3" : "A4";
  const pageMargins = { top: 30, bottom: 32, left: 32, right: 32 };
  const options = { autoFirstPage: true, margin: 30, size: pageSize, layout: "landscape" };
  document.info.Title = result.name;
  document.info.Author = "West Kenya Sugar Company";
  document.info.Subject = "Report export";

  const widths = pdfColumnWidths(document, result.columns, result.rows);
  let pageNumber = 1;
  let headingBottom = drawPdfHeading(document, result, user, pageNumber);
  let tableY = drawPdfTableHeader(document, result.columns, widths, headingBottom);
  const bottomLimit = () => document.page.height - document.page.margins.bottom - 30;

  result.rows.forEach((row, rowIndex) => {
    const cells = result.columns.map((column) => displayValue(row[column]));
    const rowHeight = Math.max(
      22,
      ...cells.map((cell, index) => document.heightOfString(cell, {
        width: widths[index] - 10,
        font: "Helvetica",
        fontSize: 7.5,
        lineGap: 1,
      }) + 10),
    );
    if (tableY + rowHeight > bottomLimit()) {
      drawPdfFooter(document, pageNumber);
      document.addPage({ ...options, margins: pageMargins });
      pageNumber += 1;
      headingBottom = drawPdfHeading(document, result, user, pageNumber, false);
      tableY = drawPdfTableHeader(document, result.columns, widths, headingBottom);
    }
    const { left } = document.page.margins;
    let x = left;
    document
      .fillColor("#ffffff")
      .rect(left, tableY, widths.reduce((sum, width) => sum + width, 0), rowHeight)
      .fill();
    cells.forEach((cell, index) => {
      document
        .fillColor("#000000")
        .font("Helvetica")
        .fontSize(7.5)
        .text(cell, x + 5, tableY + 5, { width: widths[index] - 10, height: rowHeight - 8, lineGap: 1 });
      document.strokeColor("#000000").rect(x, tableY, widths[index], rowHeight).stroke();
      x += widths[index];
    });
    tableY += rowHeight;
  });
  drawPdfFooter(document, pageNumber);
}

function reportQuery(request) {
  return Object.fromEntries(
    Object.entries(request.query || {}).sort(([first], [second]) =>
      first.localeCompare(second),
    ),
  );
}

function logExport(request, format, details) {
  console.info("report_export", {
    reportId: request.params.reportId,
    format,
    userId: request.user?.id,
    requestId: request.get("Rndr-Id") || request.get("X-Request-Id") || null,
    ...details,
  });
}

function markClientDisconnect(request, response) {
  let disconnected = false;
  const onClose = () => {
    if (!response.writableEnded) disconnected = true;
  };
  response.once("close", onClose);
  request.once("aborted", onClose);
  return () => disconnected;
}

async function writeCsv(response, result) {
  const write = async (value) => {
    if (response.write(value)) return;
    await new Promise((resolve) => response.once("drain", resolve));
  };

  await write("\uFEFF");
  await write(`${result.columns.map(csv).join(",")}\n`);
  for (const row of result.rows) {
    await write(`${result.columns.map((column) => csv(row[column])).join(",")}\n`);
  }
  response.end();
}

export default function createReportsController({ accessService, activityService } = {}) {
  const reportResultCache = createReportResultCache();

  async function getReportResult(request) {
    const query = reportQuery(request);
    const key = reportResultCache.createKey({
      userId: request.user.id,
      reportId: request.params.reportId,
      query,
    });
    const startedAt = performance.now();
    const result = await reportResultCache.getOrCreate(key, () =>
      runReport(request.params.reportId, query),
    );
    return {
      ...result,
      queryMs: Math.round(performance.now() - startedAt),
    };
  }

  async function exportResult(request, response, next, format) {
    const startedAt = performance.now();
    const isDisconnected = markClientDisconnect(request, response);
    try {
      const { value: result, cacheHit, queryMs } = await getReportResult(request);
      if (isDisconnected()) return;

      const safeName = fileName(result.name);
      if (format === "csv") {
        response.type("text/csv").attachment(`${safeName}.csv`);
        await writeCsv(response, result);
      } else if (format === "xlsx") {
        response
          .type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
          .attachment(`${safeName}.xlsx`);
        const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
          stream: response,
          useStyles: true,
          useSharedStrings: true,
        });
        const sheet = workbook.addWorksheet(result.name.slice(0, 31));
        const header = sheet.addRow(result.columns);
        header.font = { bold: true };
        header.commit();
        for (const row of result.rows) {
          sheet.addRow(result.columns.map((column) => row[column])).commit();
        }
        await workbook.commit();
      } else {
        response.type("application/pdf").attachment(`${safeName}.pdf`);
        const pageSize = result.columns.length > 8 ? "A3" : "A4";
        const document = new PDFDocument({ autoFirstPage: true, margin: 30, size: pageSize, layout: "landscape" });
        const handlePdfError = (error) => {
          logExport(request, format, {
            failed: true,
            totalMs: Math.round(performance.now() - startedAt),
            message: error.message,
          });
          if (!response.destroyed) response.destroy(error);
        };
        document.once("error", handlePdfError);
        response.once("error", handlePdfError);
        document.pipe(response);
        writePdf(document, result, request.user);
        document.end();
      }

      logExport(request, format, {
        cacheHit,
        queryMs,
        totalMs: Math.round(performance.now() - startedAt),
        rows: result.rows.length,
        columns: result.columns.length,
      });
      activityService?.record({
        action: "export",
        userId: request.user?.id,
        reportId: request.params.reportId,
        metadata: { format, cacheHit, queryMs, rows: result.rows.length, columns: result.columns.length },
      });
    } catch (error) {
      logExport(request, format, {
        failed: true,
        totalMs: Math.round(performance.now() - startedAt),
        message: error.message,
      });
      if (!response.headersSent) next(error);
    }
  }

  return {
    async catalog(request, response, next) {
      try {
        const catalog = await loadModules();
        const allowedReportIds = accessService
          ? await accessService.getEffectiveAccess(request.user)
          : request.user?.permissions || [];
        const activeReportIds = accessService ? await accessService.activeReportIds() : null;
        response.json(visibleReportCatalog(catalog, request.user, allowedReportIds, activeReportIds));
      } catch (error) {
        next(error);
      }
    },

    async filters(request, response, next) {
      try {
        const source = request.query.source || "investment";
        const filterSources = {
          harvesting: {
            cacheKey: "harvesting-locations",
            loader: loadHarvestingFilters,
          },
          plantation: {
            cacheKey: "plantation-locations",
            loader: loadPlantationFilters,
          },
          investment: {
            cacheKey: "investment-locations",
            loader: loadInvestmentFilters,
          },
          billing: {
            cacheKey: "billing-locations",
            loader: loadBillingFilters,
          },
        };
        const selectedSource = filterSources[source] || filterSources.investment;
        response.json({
          locations: (
            await cached(
              selectedSource.cacheKey,
              selectedSource.loader,
            )
          ).rows,
        });
      } catch (error) {
        next(error);
      }
    },

    async run(request, response, next) {
      try {
        const { value: result, cacheHit, queryMs } = await getReportResult(request);
        response.json(result);
        activityService?.record({
          action: "run",
          userId: request.user?.id,
          reportId: request.params.reportId,
          metadata: { cacheHit, queryMs, rows: result.rows.length, columns: result.columns.length },
        });
        console.info("report_run", {
          reportId: request.params.reportId,
          userId: request.user?.id,
          cacheHit,
          queryMs,
          rows: result.rows.length,
          columns: result.columns.length,
        });
      } catch (error) {
        next(error);
      }
    },

    async exportCsv(request, response, next) {
      await exportResult(request, response, next, "csv");
    },

    async exportXlsx(request, response, next) {
      await exportResult(request, response, next, "xlsx");
    },

    async exportPdf(request, response, next) {
      await exportResult(request, response, next, "pdf");
    },
  };
}