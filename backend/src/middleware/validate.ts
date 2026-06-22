import { Request } from 'express';
import { z, ZodTypeAny } from 'zod';

/**
 * Parse + validate a request body against a Zod schema, throwing ZodError on
 * failure. Returns the schema's *output* type so applied `.default()` values
 * are reflected (input vs output diverge once defaults are used).
 */
export function parseBody<T extends ZodTypeAny>(schema: T, req: Request): z.output<T> {
  return schema.parse(req.body);
}
