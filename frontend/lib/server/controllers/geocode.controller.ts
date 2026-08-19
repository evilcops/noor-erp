import type { Request, Response } from "express";
import { geocodeAddress, searchAddresses } from "../services/geocoding.service";
import { sendSuccess } from "../utils/apiResponse";
import { AppError } from "../utils/AppError";

export async function geocode(req: Request, res: Response) {
  const q = String(req.query.q ?? "").trim();
  if (!q) throw new AppError("BAD_REQUEST", "Query parameter q is required", 400);

  const coords = await geocodeAddress(q);
  if (!coords) {
    throw new AppError("NOT_FOUND", "Address could not be located on the map", 404);
  }

  return sendSuccess(res, coords);
}

export async function geocodeSearch(req: Request, res: Response) {
  const q = String(req.query.q ?? "").trim();
  if (q.length < 3) return sendSuccess(res, []);

  const lat = req.query.lat != null ? Number(req.query.lat) : undefined;
  const lng = req.query.lng != null ? Number(req.query.lng) : undefined;
  const near =
    lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)
      ? { lat, lng }
      : null;

  const results = await searchAddresses(q, near);
  return sendSuccess(res, results);
}
