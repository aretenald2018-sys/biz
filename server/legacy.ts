import type { Context } from "hono";

type LegacyContext = {
  params: Promise<Record<string, string>>;
};

type LegacyHandler = (request: Request, context?: LegacyContext) => Response | Promise<Response>;

export function adapt(handler: LegacyHandler) {
  return async (c: Context) => {
    return handler(c.req.raw, { params: Promise.resolve(c.req.param()) });
  };
}
