/** A -> 0, B -> 1, ..., AA -> 26, etc. */
export function colLetterToIndex(letter = "A") {
  let idx = 0;
  for (let i = 0; i < letter.length; i++) {
    idx = idx * 26 + (letter.charCodeAt(i) - 64);
  }
  return idx - 1;
}

/** "#RRGGBB" -> { red:0..1, green:0..1, blue:0..1 } */
export function hexToRgb(hex = "#ffffff") {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return { red: r / 255, green: g / 255, blue: b / 255 };
}

/**
 * Obtiene sheetId a partir del nombre de hoja.
 * Requiere un cliente `sheets` ya autenticado.
 */
export async function getSheetIdByName({ sheets, spreadsheetId, sheetName }) {
  const { data } = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(sheetId,title))",
  });
  const sheet = data.sheets.find((s) => s.properties.title === sheetName);
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found`);
  return sheet.properties.sheetId;
}
