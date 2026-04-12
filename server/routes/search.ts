import { Hono } from "hono";
import { adapt } from "../legacy";
import * as searchRoute from "@/app/api/search/route";

const searchRoutes = new Hono();

searchRoutes.get("/api/search", adapt(searchRoute.GET));

export default searchRoutes;
