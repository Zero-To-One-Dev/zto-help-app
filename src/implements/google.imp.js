import fs from "fs";
import path from "path";
import { google } from "googleapis";
import {
  colLetterToIndex,
  getSheetIdByName,
  hexToRgb,
} from "../services/google-utils.js";

class GoogleImp {
  async init() {
    const auth = await google.auth.getClient({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      },
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive.readonly",
      ],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const drive = google.drive({ version: "v3", auth });

    return { auth, sheets, drive };
  }

  /**
   * Appends values to a specified range in a Google Sheets spreadsheet.
   *
   * @async
   * @param {string} spreadsheetId - The ID of the spreadsheet to update.
   * @param {string} range - The A1 notation of the range to append the values to.
   * @param {Array<Array<any>>} values - The values to append, as a 2D array.
   * @returns {Promise<void>} A promise that resolves when the operation is complete.
   */
  async appendValues(spreadsheetId, range, values) {
    const { sheets } = await this.init();
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      includeValuesInResponse: false,
      responseDateTimeRenderOption: "FORMATTED_STRING",
      responseValueRenderOption: "FORMATTED_VALUE",
      valueInputOption: "USER_ENTERED",
      resource: {
        values,
      },
    });
  }

  /**
   * Updates values in a specified range of a Google Sheets spreadsheet.
   *
   * @async
   * @param {string} spreadsheetId - The ID of the spreadsheet to update.
   * @param {string} range - The A1 notation of the values to update.
   * @param {Array<Array<*>>} values - The values to set in the specified range.
   * @returns {Promise<void>} Resolves when the update is complete.
   */
  async updateValues(spreadsheetId, range, values) {
    const { sheets } = await this.init();
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      includeValuesInResponse: false,
      responseDateTimeRenderOption: "FORMATTED_STRING",
      responseValueRenderOption: "FORMATTED_VALUE",
      valueInputOption: "USER_ENTERED",
      resource: {
        values,
      },
    });
  }

  /**
   * Updates a row in a Google Sheet by searching for a specific cell value in a given column.
   *
   * @async
   * @param {string} spreadsheetId - The ID of the Google Spreadsheet.
   * @param {string} sheetName - The name of the sheet within the spreadsheet.
   * @param {number} lookupColumnIndex - The zero-based index of the column to search for the lookup value.
   * @param {*} lookupValue - The value to search for in the specified column.
   * @param {Array<Array<*>>} newValues - The new values to set in the row (as a 2D array, typically one row).
   * @param {string} [startColumn="A"] - The starting column letter for the update range.
   * @param {string} [endColumnLetter="C"] - The ending column letter for the update range.
   * @throws {Error} If no data is found or the lookup value is not found.
   * @returns {Promise<void>} Resolves when the row has been updated.
   */
  async updateRowByCellValue(
    spreadsheetId,
    sheetName,
    lookupColumnIndex,
    lookupValue,
    newValues,
    startColumn = "A",
    endColumnLetter = "C"
  ) {
    const values = await this.getValues(spreadsheetId, `${sheetName}`);

    if (!values || values.length === 0) throw new Error("No data found");

    const rowIndex = values.findIndex(
      (row) => row[lookupColumnIndex] === lookupValue
    );

    if (rowIndex === -1) throw new Error("Value not found");

    const sheetRow = rowIndex + 1;
    const endColumn = String.fromCharCode(
      endColumnLetter.charCodeAt(0) + newValues[0].length - 1
    );
    const range = `${sheetName}!${startColumn}${sheetRow}:${endColumn}${sheetRow}`;

    await this.updateValues(spreadsheetId, range, newValues);
  }
  /**
   * Sets a dropdown (data validation) with color-coded options in a specified range of a Google Sheet.
   * Each dropdown option can have a custom background and/or text color applied via conditional formatting.
   *
   * @async
   * @param {Object} params - The parameters for setting the dropdown and colors.
   * @param {string} params.spreadsheetId - The ID of the Google Spreadsheet.
   * @param {string} params.sheetName - The name of the sheet to modify.
   * @param {string} params.startColLetter - The starting column letter (e.g., 'A').
   * @param {string} params.endColLetter - The ending column letter (e.g., 'D').
   * @param {number} [params.startRowIndex=2] - The starting row index (1-based, default is 2).
   * @param {Array<Object>} params.options - The dropdown options.
   * @param {string} params.options[].value - The value for the dropdown option.
   * @param {string} [params.options[].bgColor] - The background color in hex (e.g., '#FF0000').
   * @param {string} [params.options[].textColor] - The text color in hex (e.g., '#FFFFFF').
   * @returns {Promise<void>} Resolves when the dropdown and formatting are applied.
   */
  async setDropdownWithColors({
    spreadsheetId,
    sheetName,
    startColLetter,
    endColLetter,
    startRowIndex = 2,
    options,
  }) {
    const { sheets } = await this.init();
    const sheetId = await getSheetIdByName({
      sheets,
      spreadsheetId,
      sheetName,
    });

    const startColumnIndex = colLetterToIndex(startColLetter);
    const endColumnIndex = colLetterToIndex(endColLetter) + 1; // exclusivo

    const gridRange = {
      sheetId,
      startRowIndex: startRowIndex - 1, // 0-based
      endRowIndex: 50000,
      startColumnIndex,
      endColumnIndex,
    };

    // 1) Data Validation (Dropdown)
    const dataValidationRule = {
      condition: {
        type: "ONE_OF_LIST",
        values: options.map((o) => ({ userEnteredValue: o.value })),
      },
      strict: true,
      showCustomUi: true,
    };
    const requests = [
      {
        repeatCell: {
          range: gridRange,
          cell: { dataValidation: dataValidationRule },
          fields: "dataValidation",
        },
      },
    ];

    // 2) Formato condicional por opción (fondo y/o texto)
    options.forEach((opt) => {
      const format = { textFormat: { bold: true } };
      if (opt.bgColor) format.backgroundColor = hexToRgb(opt.bgColor);
      if (opt.textColor)
        format.textFormat.foregroundColor = hexToRgb(opt.textColor);

      requests.push({
        addConditionalFormatRule: {
          rule: {
            ranges: [gridRange],
            booleanRule: {
              condition: {
                type: "TEXT_EQ",
                values: [{ userEnteredValue: opt.value }],
              },
              format,
            },
          },
          index: 0,
        },
      });
    });

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests },
    });
  }

  /**
   * Retrieves values from a specified range in a Google Sheets spreadsheet.
   *
   * @async
   * @param {string} spreadsheetId - The ID of the Google Sheets spreadsheet.
   * @param {string} range - The A1 notation of the values to retrieve.
   * @returns {Promise<Array<Array<string|number|boolean|undefined>>>} A promise that resolves to the values in the specified range.
   */
  async getValues(spreadsheetId, range) {
    const { sheets } = await this.init();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    return res.data.values;
  }

  /**
   * Downloads a file from Google Drive. If the file is a Google Slides presentation,
   * it exports it to the specified MIME type (default: PowerPoint). Otherwise, it downloads the file as-is.
   *
   * @async
   * @param {string} fileId - The ID of the file to download from Google Drive.
   * @param {string} destFileName - The name to save the downloaded file as.
   * @param {string} [exportMime="application/vnd.openxmlformats-officedocument.presentationml.presentation"] - The MIME type to export Google Slides presentations to.
   * @param {string} [destFolder="tmp"] - The destination folder to save the file in.
   * @returns {Promise<string>} The path to the downloaded file.
   * @throws Will throw an error if the download or export fails.
   */
  async downloadFile(
    fileId,
    destFileName,
    exportMime = "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    destFolder = "tmp"
  ) {
    const { drive } = await this.init();

    await fs.promises.mkdir(destFolder, { recursive: true });
    const filePath = path.join(destFolder, destFileName);

    const { data: meta } = await drive.files.get({
      fileId,
      fields: "mimeType",
    });

    let streamRequest;
    if (meta.mimeType === "application/vnd.google-apps.presentation") {
      streamRequest = drive.files.export(
        { fileId, mimeType: exportMime },
        { responseType: "stream" }
      );
    } else {
      streamRequest = drive.files.get(
        { fileId, alt: "media" },
        { responseType: "stream" }
      );
    }

    const destStream = fs.createWriteStream(filePath);
    const res = await streamRequest;

    await new Promise((resolve, reject) => {
      res.data.on("end", resolve).on("error", reject).pipe(destStream);
    });

    return filePath;
  }

  /**
   * Gets a sheet by name, or creates it if it doesn't exist.
   *
   * @async
   * @param {string} spreadsheetId - The ID of the spreadsheet.
   * @param {string} sheetName - The name of the sheet to get or create.
   * @param {Object} [options] - Optional configuration for the new sheet.
   * @param {number} [options.rowCount=1000] - Number of rows if creating a new sheet.
   * @param {number} [options.columnCount=26] - Number of columns if creating a new sheet.
   * @param {number} [options.index] - Position index of the sheet (0-based).
   * @param {Object} [options.gridProperties] - Additional grid properties.
   * @param {Object} [options.tabColor] - Tab color in RGB format { red: 0-1, green: 0-1, blue: 0-1 }.
   * @returns {Promise<Object>} Object with sheet information { sheetId, sheetName, created, properties }.
   *
   * @example
   * const sheet = await googleImp.getOrCreateSheet('spreadsheet-id', 'Ventas 2024');
   * console.log(sheet.sheetId); // ID de la hoja
   * console.log(sheet.created); // true si fue creada, false si ya existía
   */
  async getOrCreateSheet(spreadsheetId, sheetName, options = {}) {
    const { sheets } = await this.init();

    // Intentar obtener la hoja existente
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const existingSheet = spreadsheet.data.sheets.find(
      (s) => s.properties.title === sheetName
    );

    // Si existe, retornarla
    if (existingSheet) {
      return {
        sheetId: existingSheet.properties.sheetId,
        sheetName: existingSheet.properties.title,
        created: false,
        properties: existingSheet.properties,
      };
    }

    // Si no existe, crearla
    const {
      rowCount = 1000,
      columnCount = 26,
      index,
      gridProperties,
      tabColor,
      headerValues = null,
    } = options;

    const addSheetRequest = {
      addSheet: {
        properties: {
          title: sheetName,
          index,
          gridProperties: {
            rowCount,
            columnCount,
            ...gridProperties,
          },
          tabColor,
        },
      },
    };

    const response = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [addSheetRequest],
      },
    });

    const newSheet = response.data.replies[0].addSheet.properties;

    // Si se proporcionaron valores de encabezado, insertarlos
    if (
      headerValues &&
      Array.isArray(headerValues) &&
      headerValues.length > 0
    ) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: "RAW",
        requestBody: {
          values: [headerValues],
        },
      });
    }

    return {
      sheetId: newSheet.sheetId,
      sheetName: newSheet.title,
      created: true,
      properties: newSheet,
    };
  }
}

export default GoogleImp;
