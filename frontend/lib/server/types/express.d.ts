import type { IUser } from "../models/User.model";

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      token?: string;
      auditMeta?: {
        entityType?: string;
        entityId?: string;
        oldValue?: unknown;
      };
      file?: import("./upload").UploadedFile;
    }
  }
}

export {};
