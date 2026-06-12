import type { IUser } from "../models/User.model.js";

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      token?: string;
      auditMeta?: {
        entityType: string;
        entityId?: string;
        oldValue?: Record<string, unknown>;
      };
    }
  }
}

export {};
