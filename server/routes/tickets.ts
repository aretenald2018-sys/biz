import { Hono } from "hono";
import { adapt } from "../legacy";
import * as ticketsRoute from "@/app/api/tickets/route";
import * as ticketStatsRoute from "@/app/api/tickets/stats/route";
import * as ticketDetailRoute from "@/app/api/tickets/[id]/route";
import * as ticketAnnotationsRoute from "@/app/api/tickets/[id]/annotations/route";
import * as ticketAnnotationDetailRoute from "@/app/api/tickets/[id]/annotations/[annotationId]/route";
import * as ticketAnnotationMetaRoute from "@/app/api/tickets/[id]/annotations/[annotationId]/meta/route";
import * as ticketAnnotationMetaDetailRoute from "@/app/api/tickets/[id]/annotations/[annotationId]/meta/[metaId]/route";
import * as ticketAnnotationMetaRepliesRoute from "@/app/api/tickets/[id]/annotations/[annotationId]/meta/[metaId]/replies/route";
import * as ticketAnnotationMetaReplyDetailRoute from "@/app/api/tickets/[id]/annotations/[annotationId]/meta/[metaId]/replies/[replyId]/route";
import * as ticketAnnotationReplyDetailRoute from "@/app/api/tickets/[id]/annotations/[annotationId]/replies/[replyId]/route";
import * as ticketEmailsRoute from "@/app/api/tickets/[id]/emails/route";
import * as ticketEmailDetailRoute from "@/app/api/tickets/[id]/emails/[emailId]/route";
import * as ticketEmailFlowRoute from "@/app/api/tickets/[id]/emails/[emailId]/flow/route";
import * as ticketFlowStepsRoute from "@/app/api/tickets/[id]/flow-steps/route";
import * as ticketGraphRoute from "@/app/api/tickets/[id]/graph/route";
import * as ticketNotesRoute from "@/app/api/tickets/[id]/notes/route";
import * as ticketNoteDetailRoute from "@/app/api/tickets/[id]/notes/[noteId]/route";
import * as ticketSummaryRoute from "@/app/api/tickets/[id]/summarize/route";
import ticketFileKanbanRoutes from "./ticket-file-kanban";

const ticketRoutes = new Hono();

ticketRoutes.get("/api/tickets", adapt(ticketsRoute.GET));
ticketRoutes.post("/api/tickets", adapt(ticketsRoute.POST));
ticketRoutes.get("/api/tickets/stats", adapt(ticketStatsRoute.GET));
ticketRoutes.get("/api/tickets/:id", adapt(ticketDetailRoute.GET));
ticketRoutes.put("/api/tickets/:id", adapt(ticketDetailRoute.PUT));
ticketRoutes.delete("/api/tickets/:id", adapt(ticketDetailRoute.DELETE));
ticketRoutes.get("/api/tickets/:id/annotations", adapt(ticketAnnotationsRoute.GET));
ticketRoutes.post("/api/tickets/:id/annotations", adapt(ticketAnnotationsRoute.POST));
ticketRoutes.put("/api/tickets/:id/annotations/:annotationId", adapt(ticketAnnotationDetailRoute.PUT));
ticketRoutes.delete("/api/tickets/:id/annotations/:annotationId", adapt(ticketAnnotationDetailRoute.DELETE));
ticketRoutes.post("/api/tickets/:id/annotations/:annotationId", adapt(ticketAnnotationDetailRoute.POST));
ticketRoutes.get("/api/tickets/:id/annotations/:annotationId/meta", adapt(ticketAnnotationMetaRoute.GET));
ticketRoutes.post("/api/tickets/:id/annotations/:annotationId/meta", adapt(ticketAnnotationMetaRoute.POST));
ticketRoutes.put("/api/tickets/:id/annotations/:annotationId/meta/:metaId", adapt(ticketAnnotationMetaDetailRoute.PUT));
ticketRoutes.delete("/api/tickets/:id/annotations/:annotationId/meta/:metaId", adapt(ticketAnnotationMetaDetailRoute.DELETE));
ticketRoutes.post(
  "/api/tickets/:id/annotations/:annotationId/meta/:metaId/replies",
  adapt(ticketAnnotationMetaRepliesRoute.POST),
);
ticketRoutes.put(
  "/api/tickets/:id/annotations/:annotationId/meta/:metaId/replies/:replyId",
  adapt(ticketAnnotationMetaReplyDetailRoute.PUT),
);
ticketRoutes.delete(
  "/api/tickets/:id/annotations/:annotationId/meta/:metaId/replies/:replyId",
  adapt(ticketAnnotationMetaReplyDetailRoute.DELETE),
);
ticketRoutes.put(
  "/api/tickets/:id/annotations/:annotationId/replies/:replyId",
  adapt(ticketAnnotationReplyDetailRoute.PUT),
);
ticketRoutes.delete(
  "/api/tickets/:id/annotations/:annotationId/replies/:replyId",
  adapt(ticketAnnotationReplyDetailRoute.DELETE),
);
ticketRoutes.get("/api/tickets/:id/emails", adapt(ticketEmailsRoute.GET));
ticketRoutes.post("/api/tickets/:id/emails", adapt(ticketEmailsRoute.POST));
ticketRoutes.get("/api/tickets/:id/emails/:emailId", adapt(ticketEmailDetailRoute.GET));
ticketRoutes.put("/api/tickets/:id/emails/:emailId", adapt(ticketEmailDetailRoute.PUT));
ticketRoutes.delete("/api/tickets/:id/emails/:emailId", adapt(ticketEmailDetailRoute.DELETE));
ticketRoutes.get("/api/tickets/:id/emails/:emailId/flow", adapt(ticketEmailFlowRoute.GET));
ticketRoutes.post("/api/tickets/:id/emails/:emailId/flow", adapt(ticketEmailFlowRoute.POST));
ticketRoutes.put("/api/tickets/:id/emails/:emailId/flow", adapt(ticketEmailFlowRoute.PUT));
ticketRoutes.delete("/api/tickets/:id/emails/:emailId/flow", adapt(ticketEmailFlowRoute.DELETE));
ticketRoutes.get("/api/tickets/:id/flow-steps", adapt(ticketFlowStepsRoute.GET));
ticketRoutes.get("/api/tickets/:id/graph", adapt(ticketGraphRoute.GET));
ticketRoutes.get("/api/tickets/:id/notes", adapt(ticketNotesRoute.GET));
ticketRoutes.post("/api/tickets/:id/notes", adapt(ticketNotesRoute.POST));
ticketRoutes.get("/api/tickets/:id/notes/:noteId", adapt(ticketNoteDetailRoute.GET));
ticketRoutes.put("/api/tickets/:id/notes/:noteId", adapt(ticketNoteDetailRoute.PUT));
ticketRoutes.delete("/api/tickets/:id/notes/:noteId", adapt(ticketNoteDetailRoute.DELETE));
ticketRoutes.get("/api/tickets/:id/summarize", adapt(ticketSummaryRoute.GET));

ticketRoutes.route("/", ticketFileKanbanRoutes);

export default ticketRoutes;
