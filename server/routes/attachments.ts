import { Hono } from "hono";
import { adapt } from "../legacy";
import * as attachmentsRoute from "@/app/api/attachments/route";
import * as attachmentDetailRoute from "@/app/api/attachments/[attachmentId]/route";

const attachmentRoutes = new Hono();

attachmentRoutes.post("/api/attachments", adapt(attachmentsRoute.POST));
attachmentRoutes.get("/api/attachments/:attachmentId", adapt(attachmentDetailRoute.GET));
attachmentRoutes.delete("/api/attachments/:attachmentId", adapt(attachmentDetailRoute.DELETE));

export default attachmentRoutes;
