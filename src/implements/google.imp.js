import fs from "fs";
import path from "path";
import { google } from "googleapis";

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

  async getSheetIdByName(spreadsheetId, sheetName) {
    const { sheets } = await this.init();
    const { data } = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets(properties(sheetId,title))",
    });
    const sheet = data.sheets.find((s) => s.properties.title === sheetName);
    if (!sheet) throw new Error(`Sheet "${sheetName}" not found`);
    return sheet.properties.sheetId;
  }
  colLetterToIndex(letter) {
    // A -> 0, B -> 1 ... Z -> 25, AA -> 26 ...
    let idx = 0;
    for (let i = 0; i < letter.length; i++) {
      idx = idx * 26 + (letter.charCodeAt(i) - 64);
    }
    return idx - 1;
  }
  hexToRgb(hex) {
    const clean = hex.replace("#", "");
    const bigint = parseInt(clean, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return { red: r / 255, green: g / 255, blue: b / 255 };
  }

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
   * Crea/actualiza dropdowns y colores por opción en un rango de una hoja.
   * @param {string} spreadsheetId
   * @param {string} sheetName
   * @param {string} startColLetter  - ej. "D"
   * @param {string} endColLetter    - ej. "D" (mismo si es 1 columna)
   * @param {number} startRowIndex   - 2 para empezar debajo del header
   * @param {Array<{value:string,color?:string}>} options - lista de opciones y color HEX opcional
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
    const sheetId = await this.getSheetIdByName(spreadsheetId, sheetName);

    const startColumnIndex = this.colLetterToIndex(startColLetter);
    const endColumnIndex = this.colLetterToIndex(endColLetter) + 1; // exclusivo

    const gridRange = {
      sheetId,
      startRowIndex: startRowIndex - 1, // 0-based
      endRowIndex: 50000,
      startColumnIndex,
      endColumnIndex,
    };

    // Data Validation (Dropdown)
    const dataValidationRule = {
      condition: {
        type: "ONE_OF_LIST",
        values: options.map((o) => ({ userEnteredValue: o.value })),
      },
      strict: true,
      showCustomUi: true, // muestra el UI de dropdown
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

    // Formato condicional por opción (fondo y/o texto)
    options.forEach((opt) => {
      const format = { textFormat: { bold: true } };

      if (opt.bgColor) {
        format.backgroundColor = this.hexToRgb(opt.bgColor);
      }
      if (opt.textColor) {
        format.textFormat.foregroundColor = this.hexToRgb(opt.textColor);
      }

      // si no hay ni bg ni text color, igual agrega la regla (solo bold)
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
  async getValues(spreadsheetId, range) {
    const { sheets } = await this.init();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    return res.data.values;
  }
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
}

export default GoogleImp;
