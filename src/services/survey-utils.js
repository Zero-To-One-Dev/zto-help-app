import OpenAIImp from "../implements/openai.imp.js"

/**
 * Converts raw Google Sheets data (array of arrays) into an array of
 * objects with fixed fields and a nested `questions` object.
 *
 * @param {Array<Array<string|number>>} rawData
 *   - The first row is expected to contain header names.
 *   - Subsequent rows contain the actual data values (strings or numbers).
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
 * Counts how many times each answer was given for each closed question.
 */
export const analyzeSurvey = (parsed) => {
  const allCounters = {}

  parsed.forEach((entry) => {
    for (const [question, answer] of Object.entries(entry.questions)) {
      if (!answer || question.includes("🤔")) continue
      const key = question.trim()
      if (!allCounters[key]) allCounters[key] = {}

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
 * Enriches survey data by invoking ChatGPT (via OpenAIImp) to:
 *   1) For each open‐ended question (headers containing “🤔”):
 *      - Create a thematic summary grouping responses into ≥4 themes.
 *      - Provide “Insights” (concrete action plans).
 *      - Provide “Opportunities” (marketing initiatives).
 *   2) For each closed question:
 *      - List each option and percentage under "Categories".
 *      - Provide “Insights” (non‐obvious action plans).
 *      - Provide “Opportunities” (marketing initiatives).
 *   3) Build a Buyer Persona from all open‐ended responses:
 *      - Output under "Buyer Persona" key in result.
 *
 * @param {Object} stats
 *   - Output from analyzeSurvey(parsedData).
 * @param {Array<Object>} parsedData
 *   - Output from parseSurveyData(rawData).
 * @returns {Promise<Object>}
 *   - Maps question (and "Buyer Persona") to { categories, insights, opportunities } or { persona }.
 */
export const enrichSurveyWithAI = async (stats, parsedData) => {
  const openAI = new OpenAIImp()
  openAI.init()

  const openEndedQuestions = Object.keys(parsedData[0]?.questions || {}).filter(
    (q) => q.includes("🤔") && q.includes("?")
  )
  const closedQuestions = Object.keys(stats).filter(
    (q) => !q.includes("🤔") && q.includes("?")
  )

  const result = {}

  for (const question of openEndedQuestions) {
    const responses = parsedData
      .map((entry) => entry.questions[question])
      .filter((ans) => ans && String(ans).trim() !== "")

    const prompt = `
You are an expert marketing analyst.
Given a list of free-text responses for an open-ended question, do these three things:

1) Under "Categories", group the responses into at least 4 distinct themes, each with 1–2 example responses. Format as:
["Theme A: example1; example2", "Theme B: example1; example2", ...].

2) Under "Insights", propose 2–3 concrete action plans the marketing team can take based on those themes. Do NOT restate which theme is largest.

3) Under "Opportunities", suggest 2–3 specific marketing initiatives (campaign ideas, partnerships, messaging tweaks) derived from those insights.

Return strictly valid JSON with keys: "Categories", "Insights", and "Opportunities".

Question:
"${question}"

Responses (one per line):
${responses.map((r) => `"${r}"`).join("\n")}
    `.trim()

    try {
      const aiOutput = await openAI.openAIMessage(prompt, "")
      let parsed
      try {
        parsed = JSON.parse(aiOutput)
      } catch {
        parsed = {
          Categories: "",
          Insights: aiOutput,
          Opportunities: "",
        }
      }
      result[question] = {
        categories: parsed.Categories || "",
        insights: parsed.Insights || "",
        opportunities: parsed.Opportunities || "",
      }
    } catch (err) {
      console.error(`Error enriching open-ended question "${question}":`, err)
      result[question] = {
        categories: "",
        insights: "",
        opportunities: "",
      }
    }
  }

  for (const question of closedQuestions) {
    const answerCounts = stats[question]
    const total = Object.values(answerCounts).reduce((sum, c) => sum + c, 0)

    const lines = Object.entries(answerCounts).map(
      ([ans, count]) => `${ans}: ${((count / total) * 100).toFixed(2)}%`
    )

    const prompt = `
You are an expert marketing analyst.
Given a survey question and its answer percentages, do these three things:

1) Under "Categories", list each option with its percentage (e.g., "Option A: 50%", "Option B: 30%", ...), without commenting on ranking.

2) Under "Insights", propose 2–3 specific, non-obvious action plans based on the distribution. Avoid stating obvious facts like “X was most chosen.”

3) Under "Opportunities", suggest 2–3 concrete marketing initiatives that follow from those insights.

Return strictly valid JSON with keys: "Categories", "Insights", and "Opportunities".

Question:
"${question}"

Percentages:
${lines.join("\n")}
    `.trim()

    try {
      const aiOutput = await openAI.openAIMessage(prompt, "")
      let parsed
      try {
        parsed = JSON.parse(aiOutput)
      } catch {
        parsed = {
          Categories: lines.join("; "),
          Insights: aiOutput,
          Opportunities: "",
        }
      }
      result[question] = {
        categories: parsed.Categories || lines.join("; "),
        insights: parsed.Insights || "",
        opportunities: parsed.Opportunities || "",
      }
    } catch (err) {
      console.error(`Error enriching closed question "${question}":`, err)
      result[question] = {
        categories: lines.join("; "),
        insights: "",
        opportunities: "",
      }
    }
  }

  const allOpenResponses = openEndedQuestions.flatMap((q) =>
    parsedData
      .map((entry) => entry.questions[q])
      .filter((ans) => ans && String(ans).trim() !== "")
  )

  if (allOpenResponses.length > 0) {
    const personaPrompt = `
You are an expert marketing strategist.
Based on these free-text survey responses from open-ended questions below, create a detailed Buyer Persona for the brand, including:
- A name and demographic details (age range, occupation, lifestyle).
- Pain points, motivations, goals, and typical behaviors.
- A concise narrative or visual description of this persona’s daily life.

Return strictly valid JSON with key "Buyer Persona" containing the persona text.

Responses:
${allOpenResponses.map((r) => `"${r}"`).join("\n")}
    `.trim()

    try {
      const personaOutput = await openAI.openAIMessage(personaPrompt, "")
      let personaParsed
      try {
        personaParsed = JSON.parse(personaOutput)
      } catch {
        personaParsed = { "Buyer Persona": personaOutput }
      }
      result["Buyer Persona"] = {
        persona:
          personaParsed["Buyer Persona"] || personaParsed.BuyerPersona || "",
      }
    } catch (err) {
      console.error("Error generating Buyer Persona:", err)
      result["Buyer Persona"] = { persona: "" }
    }
  }

  return result
}
