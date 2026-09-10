import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { attachUser } from "./auth";
import authRoutes from "./routes/auth";
import jobRoutes from "./routes/jobs";
import floorRoutes from "./routes/floors";
import partsRoutes from "./routes/parts";
import accountingRoutes from "./routes/accounting";
import managementRoutes from "./routes/management";

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173", credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(attachUser);

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/floors", floorRoutes);
app.use("/api/parts-requisitions", partsRoutes);
app.use("/api/accounting", accountingRoutes);
app.use("/api/management", managementRoutes);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
app.listen(port, () => console.log(`IMPEX garage API listening on :${port}`));
