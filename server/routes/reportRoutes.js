import { Router } from "express";

const createReportRoutes = (controller) => {
  const router = Router();

  router.get("/catalog", controller.catalog);
  router.get("/filters", controller.filters);
  router.get("/:reportId/export.csv", controller.exportCsv);
  router.get("/:reportId/export.xlsx", controller.exportXlsx);
  router.get("/:reportId/export.pdf", controller.exportPdf);
  router.get("/:reportId", controller.run);

  return router;
};

export default createReportRoutes;
