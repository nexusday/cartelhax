import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const publicDir = path.join(__dirname, "public");

app.use(express.static(publicDir));

app.get("*", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`Cartel Hax escuchando en http://localhost:${port}`);
});
