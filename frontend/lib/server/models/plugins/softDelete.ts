import type { Schema } from "mongoose";

export function softDeletePlugin(schema: Schema) {
  schema.add({
    deletedAt: { type: Date, default: null, index: true },
  });

  schema.pre(/^find/, function (next) {
    const query = this as unknown as { getQuery: () => Record<string, unknown> };
    const q = query.getQuery();
    if (!("deletedAt" in q)) {
      (this as { where: (q: object) => void }).where({ deletedAt: null });
    }
    next();
  });

  schema.methods.softDelete = function () {
    this.deletedAt = new Date();
    return this.save();
  };
}
