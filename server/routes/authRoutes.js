import { Router } from "express";

const createAuthRoutes = (controller) => {
  const router = Router();
  router.get("/me", controller.getCurrentUser);
  router.post("/register", controller.register);
  router.post("/login", controller.login);
  router.post("/logout", controller.logout);
  router.put("/profile", controller.updateProfile);
  router.put("/password", controller.changePassword);
  return router;
};

export default createAuthRoutes;