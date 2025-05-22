import { google } from "googleapis"

class GoogleImp {
  async init() {
    const client = await google.auth.getClient({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    })
    const sheets = await google.sheets({ version: "v4", auth: client })

    return { client, sheets }
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
}

export default GoogleImp
