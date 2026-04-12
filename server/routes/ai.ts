import { Hono } from "hono";
import { adapt } from "../legacy";
import * as aiChatRoute from "@/app/api/ai/chat/route";
import * as aiSummarizeEmailRoute from "@/app/api/ai/summarize-email/route";

const aiRoutes = new Hono();

aiRoutes.post("/api/ai/chat", adapt(aiChatRoute.POST));
aiRoutes.post("/api/ai/summarize-email", adapt(aiSummarizeEmailRoute.POST));

export default aiRoutes;
