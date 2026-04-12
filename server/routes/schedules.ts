import { Hono } from "hono";
import { adapt } from "../legacy";
import * as schedulesRoute from "@/app/api/schedules/route";
import * as scheduleDetailRoute from "@/app/api/schedules/[id]/route";

const scheduleRoutes = new Hono();

scheduleRoutes.get("/api/schedules", adapt(schedulesRoute.GET));
scheduleRoutes.post("/api/schedules", adapt(schedulesRoute.POST));
scheduleRoutes.get("/api/schedules/:id", adapt(scheduleDetailRoute.GET));
scheduleRoutes.put("/api/schedules/:id", adapt(scheduleDetailRoute.PUT));
scheduleRoutes.delete("/api/schedules/:id", adapt(scheduleDetailRoute.DELETE));

export default scheduleRoutes;
