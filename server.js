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
  "viene_acompanado",
  "acompanante",
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

function normalizeRowsWithHeaders(rows) {
  if (!rows.length) return [HEADERS];
  const currentHeaders = (rows[0] || []).map((v) => String(v || "").trim());
  const same =
    currentHeaders.length === HEADERS.length &&
    HEADERS.every((h, i) => currentHeaders[i] === h);
  if (same) return rows;

  const dataRows = rows.slice(1);
  const rebuilt = [HEADERS];
  dataRows.forEach((row) => {
    const obj = {};
    currentHeaders.forEach((h, i) => {
      obj[h] = row[i] || "";
    });
    rebuilt.push(HEADERS.map((h) => obj[h] || ""));
  });
  return rebuilt;
}

function firstEmptyRow(rows) {
  const firstDataRow = 1;
  let target = rows.length;
  for (let r = firstDataRow; r < rows.length; r += 1) {
    const row = rows[r] || [];
    const isEmpty = HEADERS.every((_, c) => String(row[c] || "").trim() === "");
    if (isEmpty) {
      target = r;
      break;
    }
  }
  return target;
}

app.post("/api/asistencia", (req, res) => {
  const data = req.body || {};
  const required = [
    "nombre_apellidos",
    "telefono",
    "email",
    "confirmacion_asistencia",
    "viene_acompanado"
  ];
  const missing = required.filter((k) => !String(data[k] || "").trim());
  if (missing.length > 0) {
    return res.status(400).json({ ok: false, error: `Campos obligatorios: ${missing.join(", ")}` });
  }
  const hasCompanion = String(data.viene_acompanado || "").trim() === "Sí";
  const companion = data.acompanante || {};
  if (hasCompanion) {
    const companionRequired = [
      "nombre_apellidos",
      "telefono",
      "email",
      "confirmacion_asistencia"
    ];
    const companionMissing = companionRequired.filter((k) => !String(companion[k] || "").trim());
    if (companionMissing.length > 0) {
      return res
        .status(400)
        .json({ ok: false, error: `Faltan datos del acompañante: ${companionMissing.join(", ")}` });
    }
  }

  ensureWorkbook();
  const wb = XLSX.readFile(DB_PATH);
  const ws = wb.Sheets[SHEET_NAME] || wb.Sheets[wb.SheetNames[0]];
  const rows = normalizeRowsWithHeaders(readRows(ws));
  const targetRow = firstEmptyRow(rows);
  const now = new Date().toISOString();
  const mainName = String(data.nombre_apellidos || "").trim();
  const companionName = hasCompanion ? String(companion.nombre_apellidos || "").trim() : "";

  const newRow = [
    mainName,
    String(data.telefono || "").trim(),
    String(data.email || "").trim(),
    String(data.confirmacion_asistencia || "").trim(),
    String(data.intolerancias_alergenos || "").trim(),
    String(data.otros_comentarios || "").trim(),
    hasCompanion ? "Sí" : "No",
    companionName,
    now
  ];

  rows[targetRow] = newRow;
  if (hasCompanion) {
    const companionRow = [
      companionName,
      String(companion.telefono || "").trim(),
      String(companion.email || "").trim(),
      String(companion.confirmacion_asistencia || "").trim(),
      String(companion.intolerancias_alergenos || "").trim(),
      String(companion.otros_comentarios || "").trim(),
      "Sí",
      mainName,
      now
    ];
    rows[targetRow + 1] = companionRow;
  }
  writeRows(ws, rows);
  XLSX.writeFile(wb, DB_PATH);
  return res.json({ ok: true });
});

ensureWorkbook();
app.listen(PORT, () => {
  console.log(`Servidor listo en http://localhost:${PORT}`);
});
