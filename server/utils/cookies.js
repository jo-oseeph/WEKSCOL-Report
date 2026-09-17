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
  response.setHeader(
    "Set-Cookie",
    `${cookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(maxAge / 1000)}${securePart}`,
  );
};

const clearSessionCookie = (response, cookieName, options) => {
  setSessionCookie(response, cookieName, "", { ...options, maxAge: 0 });
};

export { clearSessionCookie, getSessionToken, setSessionCookie };
export default { clearSessionCookie, getSessionToken, setSessionCookie };
