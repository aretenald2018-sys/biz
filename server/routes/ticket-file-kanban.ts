import { Hono } from "hono";
import { adapt } from "../legacy";
import * as fileKanbanCategoriesRoute from "@/app/api/tickets/[id]/file-kanban/categories/route";
import * as fileKanbanCategoryDetailRoute from "@/app/api/tickets/[id]/file-kanban/categories/[catId]/route";
import * as fileKanbanCardsRoute from "@/app/api/tickets/[id]/file-kanban/cards/route";
import * as fileKanbanCardDetailRoute from "@/app/api/tickets/[id]/file-kanban/cards/[cardId]/route";
import * as fileKanbanReorderRoute from "@/app/api/tickets/[id]/file-kanban/cards/reorder/route";
import * as fileKanbanAutoPopulateRoute from "@/app/api/tickets/[id]/file-kanban/auto-populate/route";

const ticketFileKanbanRoutes = new Hono();

ticketFileKanbanRoutes.get("/api/tickets/:id/file-kanban/categories", adapt(fileKanbanCategoriesRoute.GET));
ticketFileKanbanRoutes.post("/api/tickets/:id/file-kanban/categories", adapt(fileKanbanCategoriesRoute.POST));
ticketFileKanbanRoutes.put("/api/tickets/:id/file-kanban/categories/:catId", adapt(fileKanbanCategoryDetailRoute.PUT));
ticketFileKanbanRoutes.delete("/api/tickets/:id/file-kanban/categories/:catId", adapt(fileKanbanCategoryDetailRoute.DELETE));

ticketFileKanbanRoutes.get("/api/tickets/:id/file-kanban/cards", adapt(fileKanbanCardsRoute.GET));
ticketFileKanbanRoutes.post("/api/tickets/:id/file-kanban/cards", adapt(fileKanbanCardsRoute.POST));
ticketFileKanbanRoutes.put("/api/tickets/:id/file-kanban/cards/reorder", adapt(fileKanbanReorderRoute.PUT));
ticketFileKanbanRoutes.put("/api/tickets/:id/file-kanban/cards/:cardId", adapt(fileKanbanCardDetailRoute.PUT));
ticketFileKanbanRoutes.delete("/api/tickets/:id/file-kanban/cards/:cardId", adapt(fileKanbanCardDetailRoute.DELETE));

ticketFileKanbanRoutes.post("/api/tickets/:id/file-kanban/auto-populate", adapt(fileKanbanAutoPopulateRoute.POST));

export default ticketFileKanbanRoutes;
