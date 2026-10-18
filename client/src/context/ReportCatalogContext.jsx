import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { reports as reportsApi } from "../api/api.js";
import { useAuth } from "./AuthContext.jsx";

const CACHE_PREFIX = "wekscol-report-catalog:";
const CACHE_TTL_MS = 5 * 60 * 1000;
const memoryCache = new Map();
const ReportCatalogContext = createContext(null);

function userKey(user) {
  return user?.id || user?.email || null;
}

function storageKey(key) {
  return `${CACHE_PREFIX}${key}`;
}

function readSessionCache(key) {
  try {
    const raw = window.sessionStorage.getItem(storageKey(key));
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (!Array.isArray(cached.categories) || !Number.isFinite(cached.cachedAt)) {
      window.sessionStorage.removeItem(storageKey(key));
      return null;
    }
    return cached;
  } catch {
    return null;
  }
}

function readCache(key) {
  return memoryCache.get(key) || readSessionCache(key);
}

function writeCache(key, categories) {
  const cached = { categories, cachedAt: Date.now() };
  memoryCache.set(key, cached);
  try {
    window.sessionStorage.setItem(storageKey(key), JSON.stringify(cached));
  } catch {
    // Continue with the in-memory cache when sessionStorage is unavailable.
  }
}

function clearCache(key) {
  if (!key) return;
  memoryCache.delete(key);
  try {
    window.sessionStorage.removeItem(storageKey(key));
  } catch {
    // Ignore storage cleanup failures.
  }
}

export function ReportCatalogProvider({ children }) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [reportCategories, setReportCategories] = useState([]);
  const [catalogError, setCatalogError] = useState("");
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const previousUserKeyRef = useRef(null);

  const refreshCatalog = useCallback(async (key, isMounted) => {
    try {
      const data = await reportsApi.getCatalog();
      const categories = data.categories || [];
      writeCache(key, categories);
      if (isMounted()) {
        setReportCategories(categories);
        setCatalogError("");
      }
    } catch (error) {
      if (isMounted()) setCatalogError(error.message);
    } finally {
      if (isMounted()) setIsCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthLoading) return undefined;

    const key = userKey(user);
    if (previousUserKeyRef.current && previousUserKeyRef.current !== key) {
      clearCache(previousUserKeyRef.current);
    }
    previousUserKeyRef.current = key;

    if (!key) {
      setReportCategories([]);
      setCatalogError("");
      setIsCatalogLoading(false);
      return undefined;
    }

    let active = true;
    const isMounted = () => active;
    const cached = readCache(key);

    if (cached) {
      setReportCategories(cached.categories);
      setIsCatalogLoading(false);
      setCatalogError("");
    } else {
      setReportCategories([]);
      setIsCatalogLoading(true);
    }

    if (!cached || Date.now() - cached.cachedAt >= CACHE_TTL_MS) {
      refreshCatalog(key, isMounted);
    }

    return () => {
      active = false;
    };
  }, [isAuthLoading, refreshCatalog, user]);

  return (
    <ReportCatalogContext.Provider
      value={{ reportCategories, catalogError, isCatalogLoading, refreshCatalog }}
    >
      {children}
    </ReportCatalogContext.Provider>
  );
}

export function useReportCatalog() {
  const context = useContext(ReportCatalogContext);
  if (!context) {
    throw new Error("useReportCatalog must be used within a ReportCatalogProvider.");
  }
  return context;
}