import { Hono } from "hono";
import { adapt } from "../legacy";
import * as emailAttachmentRoute from "@/app/api/email-attachments/[attachmentId]/route";

const emailAttachmentRoutes = new Hono();

emailAttachmentRoutes.get("/api/email-attachments/:attachmentId", adapt(emailAttachmentRoute.GET));

export default emailAttachmentRoutes;
