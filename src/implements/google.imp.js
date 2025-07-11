import fs from "fs"
import path from "path"
import { google } from "googleapis"

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
    })

    const sheets = google.sheets({ version: "v4", auth })
    const drive = google.drive({ version: "v3", auth })

    return { auth, sheets, drive }
  }
  async appendValues(spreadsheetId, range, values) {
    const { sheets } = await this.init()
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
    })
  }
  async getValues(spreadsheetId, range) {
    const { sheets } = await this.init()
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    })
    return res.data.values
  }
  async downloadFile(
    fileId,
    destFileName,
    exportMime = "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    destFolder = "tmp"
  ) {
    const { drive } = await this.init()

    await fs.promises.mkdir(destFolder, { recursive: true })
    const filePath = path.join(destFolder, destFileName)

    const { data: meta } = await drive.files.get({
      fileId,
      fields: "mimeType",
    })

    let streamRequest
    if (meta.mimeType === "application/vnd.google-apps.presentation") {
      streamRequest = drive.files.export(
        { fileId, mimeType: exportMime },
        { responseType: "stream" }
      )
    } else {
      streamRequest = drive.files.get(
        { fileId, alt: "media" },
        { responseType: "stream" }
      )
    }

    const destStream = fs.createWriteStream(filePath)
    const res = await streamRequest

    await new Promise((resolve, reject) => {
      res.data.on("end", resolve).on("error", reject).pipe(destStream)
    })

    return filePath
  }
}

export default GoogleImp
