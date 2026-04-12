import { Hono } from "hono";
import { adapt } from "../legacy";
import * as contractsRoute from "@/app/api/contracts/route";
import * as contractDetailRoute from "@/app/api/contracts/[id]/route";
import * as contractFilesRoute from "@/app/api/contracts/[id]/files/route";
import * as contractFileDetailRoute from "@/app/api/contracts/files/[fileId]/route";
import * as contractImportRoute from "@/app/api/contracts/import/route";
import * as contractSearchRoute from "@/app/api/contracts/search/route";
import * as contractVersionsBatchRoute from "@/app/api/contracts/versions/batch/route";
import * as contractVersionsRoute from "@/app/api/contracts/[id]/versions/route";
import * as contractOcrRoute from "@/app/api/contracts/[id]/ocr/route";

const contractRoutes = new Hono();

contractRoutes.get("/api/contracts", adapt(contractsRoute.GET));
contractRoutes.post("/api/contracts", adapt(contractsRoute.POST));
contractRoutes.post("/api/contracts/import", adapt(contractImportRoute.POST));
contractRoutes.post("/api/contracts/search", adapt(contractSearchRoute.POST));
contractRoutes.get("/api/contracts/versions/batch", adapt(contractVersionsBatchRoute.GET));
contractRoutes.get("/api/contracts/files/:fileId", adapt(contractFileDetailRoute.GET));
contractRoutes.delete("/api/contracts/files/:fileId", adapt(contractFileDetailRoute.DELETE));
contractRoutes.get("/api/contracts/:id", adapt(contractDetailRoute.GET));
contractRoutes.put("/api/contracts/:id", adapt(contractDetailRoute.PUT));
contractRoutes.delete("/api/contracts/:id", adapt(contractDetailRoute.DELETE));
contractRoutes.post("/api/contracts/:id/files", adapt(contractFilesRoute.POST));
contractRoutes.get("/api/contracts/:id/ocr", adapt(contractOcrRoute.GET));
contractRoutes.get("/api/contracts/:id/versions", adapt(contractVersionsRoute.GET));
contractRoutes.post("/api/contracts/:id/versions", adapt(contractVersionsRoute.POST));
contractRoutes.put("/api/contracts/:id/versions", adapt(contractVersionsRoute.PUT));
contractRoutes.delete("/api/contracts/:id/versions", adapt(contractVersionsRoute.DELETE));

export default contractRoutes;
