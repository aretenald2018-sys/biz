import { Hono } from "hono";
import { adapt } from "../legacy";
import * as categoryRoutes from "@/app/api/kanban/categories/route";
import * as categoryDetailRoutes from "@/app/api/kanban/categories/[id]/route";
import * as boardRoutes from "@/app/api/kanban/board/route";
import * as reorderRoutes from "@/app/api/kanban/reorder/route";

const kanbanRoutes = new Hono();

kanbanRoutes.get("/api/kanban/categories", adapt(categoryRoutes.GET));
kanbanRoutes.post("/api/kanban/categories", adapt(categoryRoutes.POST));
kanbanRoutes.put("/api/kanban/categories/:id", adapt(categoryDetailRoutes.PUT));
kanbanRoutes.delete("/api/kanban/categories/:id", adapt(categoryDetailRoutes.DELETE));

kanbanRoutes.get("/api/kanban/board", adapt(boardRoutes.GET));
kanbanRoutes.post("/api/kanban/reorder", adapt(reorderRoutes.POST));

export default kanbanRoutes;
