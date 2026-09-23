function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf("=");
        const name = part.slice(0, separator).trim();
        const value = part.slice(separator + 1).trim();
        return [name, decodeURIComponent(value)];
      }),
  );
}

const getSessionToken = (request, cookieName) => {
  return parseCookies(request.headers.cookie)[cookieName] || null;
};

const setSessionCookie = (
  response,
  cookieName,
  token,
  { maxAge, secure },
) => {
  const securePart = secure ? "; Secure" : "";
  // Cross-site cookies (frontend on Vercel, backend on Render -- different
  // registrable domains) require SameSite=None, and browsers only honor
  // SameSite=None when the cookie is also Secure. In local development the
  // frontend/backend share "localhost" so SameSite=Lax (which does not
  // require HTTPS) keeps working over plain HTTP.
  const sameSite = secure ? "None" : "Lax";
  response.setHeader(
    "Set-Cookie",
    `${cookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=${Math.floor(maxAge / 1000)}${securePart}`,
  );
};

const clearSessionCookie = (response, cookieName, options) => {
  setSessionCookie(response, cookieName, "", { ...options, maxAge: 0 });
};

export { clearSessionCookie, getSessionToken, setSessionCookie };
export default { clearSessionCookie, getSessionToken, setSessionCookie };
