/**
 * Converts a column letter (e.g., "A", "B", ..., "Z", "AA", etc.) to its zero-based index.
 *
 * @param {string} [letter="A"] - The column letter(s) to convert.
 * @returns {number} The zero-based column index corresponding to the given letter.
 */
export function colLetterToIndex(letter = "A") {
  let idx = 0;
  for (let i = 0; i < letter.length; i++) {
    idx = idx * 26 + (letter.charCodeAt(i) - 64);
  }
  return idx - 1;
}

/**
 * Converts a hex color string to an object with normalized RGB values.
 *
 * @param {string} [hex="#ffffff"] - The hex color string (e.g., "#ff0000").
 * @returns {{ red: number, green: number, blue: number }} An object with red, green, and blue values normalized between 0 and 1.
 */
export function hexToRgb(hex = "#ffffff") {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return { red: r / 255, green: g / 255, blue: b / 255 };
}


/**
 * Retrieves the sheet ID of a specific sheet by its name from a Google Spreadsheet.
 *
 * @async
 * @param {Object} params - The parameters for the function.
 * @param {import('@googleapis/sheets').sheets_v4.Sheets} params.sheets - The Google Sheets API client instance.
 * @param {string} params.spreadsheetId - The ID of the Google Spreadsheet.
 * @param {string} params.sheetName - The name of the sheet to find.
 * @returns {Promise<number>} The sheet ID of the specified sheet.
 * @throws {Error} If the sheet with the given name is not found.
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
