const notFound = (request, response) => {
  response.status(404).json({ error: "Route not found." });
};

export default notFound;