import ExcelJS from "exceljs"
import OpenAIImp from "../implements/openai.imp.js"

/**
 * Converts raw Google Sheets data (array of arrays) into an array of
 * objects with fixed fields and a nested `questions` object.
 *
 * @param {Array<Array<string>>} rawData
 *   - The first row is expected to contain header names.
 *   - Subsequent rows contain the actual data values.
 *   - Example structure:
 *     [
 *       ['surveyName', 'email', 'customerFirstName', ..., 'Question A', 'Question B', ...],
 *       ['Post Purchase 2025', 'user@example.com', 'Alice', ..., 'Answer A1', 'Answer B1', ...],
 *       ...
 *     ]
 *
 * @returns {Array<Object>}
 *   Each element is an object with:
 *     - surveyName: string
 *     - email: string
 *     - customerFirstName: string
 *     - customerLastName: string
 *     - responseDate: string
 *     - channelName: string
 *     - orderId: string
 *     - orderValue: string
 *     - questions: Object where each key is a question (string) and each
 *       value is the respondent’s answer (string, possibly containing ‘|’-separated values).
 *
 *   Example output:
 *   [
 *     {
 *       surveyName: 'Post Purchase 2025',
 *       email: 'user@example.com',
 *       customerFirstName: 'Alice',
 *       customerLastName: 'Smith',
 *       responseDate: '2025-06-01T19:03:30.174Z',
 *       channelName: 'post-checkout',
 *       orderId: '5874651791517',
 *       orderValue: '42.79',
 *       questions: {
 *         'Hey 👋, how did you hear about us?': 'Instagram',
 *         'How long did it take you to make your first purchase?': 'Week',
 *         ...
 *       }
 *     },
 *     ...
 *   ]
 */
export const parseSurveyData = (rawData) => {
  const [headers, ...rows] = rawData

  const fixedKeys = [
    "surveyName",
    "email",
    "customerFirstName",
    "customerLastName",
    "responseDate",
    "channelName",
    "orderId",
    "orderValue",
  ]

  return rows.map((row) => {
    const fixedPart = {}
    const questionsPart = {}

    headers.forEach((key, index) => {
      const value = row[index] ?? ""
      if (index < fixedKeys.length) {
        fixedPart[fixedKeys[index]] = value
      } else {
        questionsPart[key] = value
      }
    })

    return {
      ...fixedPart,
      questions: questionsPart,
    }
  })
}

/**
 * Analyzes the parsed survey data to count how many times each answer
 * was given for each question.
 *
 * @param {Array<Object>} parsed
 *   - The output array from `parseSurveyData()`. Each element has a `questions`
 *     object with question texts as keys and answer strings as values.
 *   - If a single field contains multiple answers (separated by '|'),
 *     each sub-answer is counted separately.
 *
 * @returns {Object}
 *   - An object where each key is a question (string), and its value is another
 *     object mapping each distinct answer (string) to its count (number).
 *
 *   Example output:
 *   {
 *     "Hey 👋, how did you hear about us?": {
 *       "Instagram": 5,
 *       "Google Search": 3,
 *       "From a friend": 4,
 *       "Other": 2
 *     },
 *     "How long did it take you to make your first purchase after discovering Dr.Ming?": {
 *       "Same day": 6,
 *       "1-3 days": 4,
 *       "Week": 3,
 *       "Month": 1
 *     },
 *     ...
 *   }
 */
export const analyzeSurvey = (parsed) => {
  const allCounters = {}

  parsed.forEach((entry) => {
    for (const [question, answer] of Object.entries(entry.questions)) {
      if (!answer) continue
      const key = question.trim()
      if (!allCounters[key]) allCounters[key] = {}

      // Split multiple answers separated by '|' into individual values
      const values = answer.includes("|")
        ? answer.split("|").map((v) => v.trim())
        : [answer.trim()]

      values.forEach((val) => {
        if (!val) return
        allCounters[key][val] = (allCounters[key][val] || 0) + 1
      })
    }
  })

  return allCounters
}

/**
 * Takes parsed survey data and raw stats (counts per answer per question),
 * then uses OpenAI (GPT-4) to generate “insights” and “opportunities” for each
 * question. Open‐ended questions (headers containing “🤔”) are sent as full‐text
 * prompts; closed questions are summarized by counts and percentages.
 *
 * Each question key will map to an object:
 *   {
 *     insights: string,
 *     opportunities: string
 *   }
 *
 * @param {Object} stats
 *   - Output from analyzeSurvey(parsedData):
 *     {
 *       "<question>": { "<answer>": count, ... },
 *       ...
 *     }
 *
 * @param {Array<Object>} parsedData
 *   - The output from parseSurveyData(rawData). Used to collect open‐ended responses.
 *
 * @returns {Promise<Object>}
 *   An object mapping question headers to { insights, opportunities }.
 *   E.g.:
 *     {
 *       "🤔 What did you like most about our product?": {
 *         insights: "Many respondents mention improved digestion and reduced bloating...",
 *         opportunities: "Develop a marketing campaign around digestive benefits..."
 *       },
 *       "How did you hear about us?": {
 *         insights: "Instagram and Google Search dominate discovery sources...",
 *         opportunities: "Invest more in Instagram ads and optimize for search keywords related to ‘digestive health’..."
 *       },
 *       ...
 *     }
 */
export const enrichSurveyWithAI = async (stats, parsedData) => {
  const openAI = new OpenAIImp()

  // Collect all question keys
  const questionKeys = Object.keys(stats)

  // Separate open‐ended vs closed by checking for the "🤔" emoji
  const openEndedQuestions = questionKeys.filter((q) => q.includes("🤔"))
  const closedQuestions = questionKeys.filter((q) => !q.includes("🤔"))

  const result = {}

  // Process open‐ended questions
  for (const question of openEndedQuestions) {
    // Collect all non‐empty responses for this question
    const responses = parsedData
      .map((entry) => entry.questions[question])
      .filter((ans) => ans && String(ans).trim() !== "")

    // Build user prompt: ask GPT to extract insights/opportunities for marketing
    const prompt = `
You are a marketing insights analyst. 
Given a list of free-text responses from a survey question, do two things:
1) Under "Insights", summarize the main themes, patterns, or notable points that appear in these responses.
2) Under "Opportunities", generate actionable marketing recommendations based on those themes.

Return your answer in JSON format with two keys: "Insights" (string) and "Opportunities" (string).

Example output:
{
  "Insights": "Many users reported that ...",
  "Opportunities": "Based on these insights, the marketing team could ..."
}

The question is:
"${question}"

The responses are:
${responses.map((r) => `"${r}"`).join("\n")}
    `.trim()

    try {
      const aiOutput = await openAI.openAIMessage(prompt, "")
      // Expecting a JSON string; try to parse:
      let parsed
      try {
        parsed = JSON.parse(aiOutput)
      } catch {
        // If parsing fails, fallback: wrap raw text under insights, leave opportunities blank
        parsed = {
          Insights: aiOutput,
          Opportunities: "",
        }
      }
      result[question] = {
        insights: parsed.Insights || "",
        opportunities: parsed.Opportunities || "",
      }
    } catch (err) {
      console.error(`Error enriching open question "${question}":`, err)
      result[question] = {
        insights: "",
        opportunities: "",
      }
    }
  }

  // Process closed questions
  for (const question of closedQuestions) {
    const answerCounts = stats[question]
    // Compute total responses and percentages
    const total = Object.values(answerCounts).reduce((sum, c) => sum + c, 0)
    const lines = Object.entries(answerCounts).map(
      ([ans, count]) =>
        `- ${ans}: ${count} (${((count / total) * 100).toFixed(2)}%)`
    )
    const summaryText = `
The survey question is:
"${question}"

Answer distribution:
${lines.join("\n")}
`.trim()

    const prompt = `
You are a marketing insights analyst. 
Given the question and its answer distribution, do two things:
1) Under "Insights", identify key findings (e.g., top choices, surprising patterns).
2) Under "Opportunities", suggest actionable marketing steps based on these findings.

Return strictly valid JSON with keys "Insights" and "Opportunities".

${summaryText}
    `.trim()

    try {
      const aiOutput = await openAI.openAIMessage(prompt, "")
      let parsed
      try {
        parsed = JSON.parse(aiOutput)
      } catch {
        parsed = {
          Insights: aiOutput,
          Opportunities: "",
        }
      }
      result[question] = {
        insights: parsed.Insights || "",
        opportunities: parsed.Opportunities || "",
      }
    } catch (err) {
      console.error(`Error enriching closed question "${question}":`, err)
      result[question] = {
        insights: "",
        opportunities: "",
      }
    }
  }

  return result
}

/**
 * Generates an Excel file summarizing survey statistics, including:
 * - One sheet ("Survey Summary") with columns: Question, Answer, Count, Percentage.
 * - One sheet ("Insights & Opportunities") with columns: Question, Insights, Opportunities.
 *
 * @param {Object} stats
 *   - The output object from `analyzeSurvey()`. Each key is a question string,
 *     and its value is an object mapping answer strings to their counts.
 *
 * @param {Array<Object>} parsedData
 *   - The array returned by `parseSurveyData(rawData)`, which contains each respondent’s answers.
 *
 * @param {string} filePath
 *   - The filesystem path where the .xlsx file will be written.
 *   - Defaults to "survey-report.xlsx" in the current working directory.
 *
 * @returns {Promise<string>}
 *   - Resolves with the same `filePath` once the workbook has been written.
 *
 * Example usage:
 *   const stats = analyzeSurvey(parsedData);
 *   const filePath = await generateExcelReportWithInsights(stats, parsedData, "./tmp/survey-report.xlsx");
 */
export const generateExcelReport = async (
  stats,
  parsedData,
  filePath = "survey-report.xlsx"
) => {
  const workbook = new ExcelJS.Workbook()

  const summarySheet = workbook.addWorksheet("Survey Summary")
  summarySheet.columns = [
    { header: "Question", key: "question", width: 60 },
    { header: "Answer", key: "answer", width: 40 },
    { header: "Count", key: "count", width: 10 },
    { header: "Percentage", key: "percentage", width: 12 },
  ]

  for (const [question, answers] of Object.entries(stats)) {
    const total = Object.values(answers).reduce((sum, c) => sum + c, 0)
    const sortedAnswers = Object.entries(answers).sort((a, b) => b[1] - a[1])
    for (const [answer, count] of sortedAnswers) {
      const percentage =
        total > 0 ? ((count / total) * 100).toFixed(2) + "%" : "0.00%"
      summarySheet.addRow({
        question,
        answer,
        count,
        percentage,
      })
    }
  }

  const insightsMap = await enrichSurveyWithAI(stats, parsedData)
  const ioSheet = workbook.addWorksheet("Insights & Opportunities")
  ioSheet.columns = [
    { header: "Question", key: "question", width: 60 },
    { header: "Insights", key: "insights", width: 60 },
    { header: "Opportunities", key: "opportunities", width: 60 },
  ]

  for (const question of Object.keys(stats)) {
    const { insights, opportunities } = insightsMap[question] || {
      insights: "",
      opportunities: "",
    }
    ioSheet.addRow({
      question,
      insights,
      opportunities,
    })
  }

  await workbook.xlsx.writeFile(filePath)
  return filePath
}
