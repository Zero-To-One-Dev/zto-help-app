import ExcelJS from "exceljs"

/**
 * Generates an Excel file summarizing survey statistics and AI-enriched
 * insights/opportunities, including:
 *   - Sheet "Survey Summary": Question | Answer | Count | Percentage
 *   - Sheet "Insights & Opportunities": Question | Categories | Insights | Opportunities
 *   - Sheet "Buyer Persona": Persona description
 *
 * @param {Object} stats
 *   - Output of analyzeSurvey(parsedData).
 *
 * @param {Array<Object>} parsedData
 *   - Output of parseSurveyData(rawData).
 *
 * @param {string} filePath
 *   - Path where the .xlsx file will be written.
 *
 * @returns {Promise<string>}
 *   - Resolves with the same `filePath` once saved.
 */
export const generateExcelReport = async (
  stats,
  enrichedMap,
  filePath = "survey-report.xlsx"
) => {
  const workbook = new ExcelJS.Workbook()

  const closedWithQuestionMark = Object.keys(stats).filter((q) =>
    q.includes("?")
  )

  const summarySheet = workbook.addWorksheet("Survey Summary")
  summarySheet.columns = [
    { header: "Question", key: "question", width: 60 },
    { header: "Answer", key: "answer", width: 40 },
    { header: "Count", key: "count", width: 10 },
    { header: "Percentage", key: "percentage", width: 12 },
  ]

  for (const question of closedWithQuestionMark) {
    const answers = stats[question]
    const total = Object.values(answers).reduce((sum, c) => sum + c, 0)
    const sortedAnswers = Object.entries(answers).sort((a, b) => b[1] - a[1])

    for (const [answer, count] of sortedAnswers) {
      const percentage =
        total > 0 ? ((count / total) * 100).toFixed(2) + "%" : "0.00%"
      summarySheet.addRow({ question, answer, count, percentage })
    }
  }

  const ioSheet = workbook.addWorksheet("Insights & Opportunities")
  ioSheet.columns = [
    { header: "Question", key: "question", width: 60 },
    { header: "Categories", key: "categories", width: 60 },
    { header: "Insights", key: "insights", width: 80 },
    { header: "Opportunities", key: "opportunities", width: 80 },
  ]

  const enrichedWithQuestionMark = Object.keys(enrichedMap).filter(
    (q) => q.includes("?") || q === "Buyer Persona"
  )

  for (const question of enrichedWithQuestionMark) {
    if (question === "Buyer Persona") continue
    const data = enrichedMap[question]
    ioSheet.addRow({
      question,
      categories: data.categories || "",
      insights: data.insights || "",
      opportunities: data.opportunities || "",
    })
  }

  const personaSheet = workbook.addWorksheet("Buyer Persona")
  personaSheet.columns = [{ header: "Persona", key: "persona", width: 100 }]
  if (enrichedMap["Buyer Persona"]) {
    personaSheet.addRow({
      persona: enrichedMap["Buyer Persona"].persona,
    })
  }

  await workbook.xlsx.writeFile(filePath)
  return filePath
}
