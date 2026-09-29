const createAdminController = ({ adminService, reportCatalog }) => ({
  async listUsers(request, response, next) {
    try {
      response.json({ users: await adminService.listUsers() });
    } catch (error) {
      next(error);
    }
  },

  async listReports(request, response) {
    response.json({ reports: reportCatalog });
  },

  async getPermissions(request, response, next) {
    try {
      response.json(await adminService.getPermissions(Number(request.params.userId)));
    } catch (error) {
      next(error);
    }
  },

  async updateStatus(request, response, next) {
    try {
      response.json({
        user: await adminService.updateStatus(Number(request.params.userId), request.body?.status),
      });
    } catch (error) {
      next(error);
    }
  },

  async updatePermissions(request, response, next) {
    try {
      response.json({
        user: await adminService.updatePermissions(
          Number(request.params.userId),
          request.body?.reportIds,
          request.user.id,
        ),
      });
    } catch (error) {
      next(error);
    }
  },
});

export default createAdminController;