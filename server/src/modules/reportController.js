import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { performance } from "node:perf_hooks";
import { loadModules } from "./loadModules.js";
import { visibleReportCatalog } from "./reportCatalog.js";
import runReport from "./report-engine/runReport.js";
import createReportResultCache from "./report-engine/reportResultCache.js";
import { cached } from "./report-engine/filtersCache.js";
import { loadInvestmentFilters } from "./agriculture/investment/investment.query.js";
import { loadHarvestingFilters } from "./agriculture/harvesting/harvesting.query.js";
import { loadPlantationFilters } from "./agriculture/plantation/plantation.query.js";

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

export default function createReportsController() {
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
        const document = new PDFDocument({
          autoFirstPage: true,
          margin: 30,
          size: "A4",
          layout: "landscape",
        });
        document.pipe(response);
        document.fontSize(14).text(result.name).moveDown();
        document.fontSize(7).text(result.columns.join(" | "));
        for (const row of result.rows) {
          document.text(
            result.columns.map((column) => row[column] ?? "").join(" | "),
          );
        }
        document.end();
      }

      logExport(request, format, {
        cacheHit,
        queryMs,
        totalMs: Math.round(performance.now() - startedAt),
        rows: result.rows.length,
        columns: result.columns.length,
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
        response.json(visibleReportCatalog(catalog, request.user));
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