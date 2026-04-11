const express = require("express");
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, "base_datos_asistencia.xlsx");
const SHEET_NAME = "Asistencia";
const HEADERS = [
  "nombre_apellidos",
  "telefono",
  "email",
  "confirmacion_asistencia",
  "intolerancias_alergenos",
  "otros_comentarios",
  "fecha_registro"
];

app.use(express.json());
app.use(express.static(__dirname));

function ensureWorkbook() {
  if (fs.existsSync(DB_PATH)) return;
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([HEADERS]);
  XLSX.utils.book_append_sheet(wb, ws, SHEET_NAME);
  XLSX.writeFile(wb, DB_PATH);
}

function readRows(ws) {
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
}

function writeRows(ws, rows) {
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
  Object.keys(ws).forEach((k) => {
    if (k[0] !== "!") delete ws[k];
  });
  const newWs = XLSX.utils.aoa_to_sheet(rows);
  Object.assign(ws, newWs);
  ws["!ref"] = newWs["!ref"] || `A1:${XLSX.utils.encode_cell({ c: range.e.c, r: range.e.r })}`;
}

app.post("/api/asistencia", (req, res) => {
  const data = req.body || {};
  const required = ["nombre_apellidos", "telefono", "email", "confirmacion_asistencia"];
  const missing = required.filter((k) => !String(data[k] || "").trim());
  if (missing.length > 0) {
    return res.status(400).json({ ok: false, error: `Campos obligatorios: ${missing.join(", ")}` });
  }

  ensureWorkbook();
  const wb = XLSX.readFile(DB_PATH);
  const ws = wb.Sheets[SHEET_NAME] || wb.Sheets[wb.SheetNames[0]];
  const rows = readRows(ws);

  const firstDataRow = 1;
  let targetRow = rows.length;
  for (let r = firstDataRow; r < rows.length; r += 1) {
    const row = rows[r] || [];
    const isEmpty = HEADERS.every((_, c) => String(row[c] || "").trim() === "");
    if (isEmpty) {
      targetRow = r;
      break;
    }
  }

  const newRow = [
    String(data.nombre_apellidos || "").trim(),
    String(data.telefono || "").trim(),
    String(data.email || "").trim(),
    String(data.confirmacion_asistencia || "").trim(),
    String(data.intolerancias_alergenos || "").trim(),
    String(data.otros_comentarios || "").trim(),
    new Date().toISOString()
  ];

  rows[targetRow] = newRow;
  writeRows(ws, rows);
  XLSX.writeFile(wb, DB_PATH);
  return res.json({ ok: true });
});

ensureWorkbook();
app.listen(PORT, () => {
  console.log(`Servidor listo en http://localhost:${PORT}`);
});
