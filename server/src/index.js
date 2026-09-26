import createApp from "./app.js";
const { app, container } = await createApp();
const server = app.listen(container.config.port, () =>
  console.log(
    `WESCOL server listening on http://localhost:${container.config.port}`,
  ),
);
async function shutdown(signal) {
  console.warn(`WESCOL server received ${signal}; shutting down.`);
  server.close(async () => {
    await container.db.end();
    process.exit(0);
  });
}

