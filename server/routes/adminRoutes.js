import { Router } from "express";

const createAdminRoutes = (controller) => {
  const router = Router();
  router.get("/users", controller.listUsers);
  router.get("/reports", controller.listReports);
  router.patch("/users/:userId/status", controller.updateStatus);
  router.put("/users/:userId/permissions", controller.updatePermissions);
  return router;
};

export default createAdminRoutes;