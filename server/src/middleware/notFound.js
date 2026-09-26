export default function notFound(request, response) {
  response.status(404).json({ error: "Not found." });
}
