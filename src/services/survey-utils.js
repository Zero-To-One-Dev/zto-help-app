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
      let value = row[index] ?? ""
      if (value.includes("Other")) {
        value = "Other"
      }
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
You are a professional marketing analyst specializing in qualitative data interpretation.

You will receive a list of free-text responses to an open-ended survey question. Your task is to analyze the responses and deliver structured insights useful for marketing strategy.

Instructions:

1. Analyze the responses carefully. Even if they are vague, diverse, or very short, do your best to extract common themes or sentiment patterns.

2. Group the responses into **at least four (4)** meaningful **categories or themes** based on their content, sentiment, or implied needs/preferences. Use abstraction if needed (e.g., group similar sentiments, pain points, or wishes).

3. After the table, write an **"Insights"** section with **2-3 clear strategic takeaways** — explain what the marketing or product team can learn from these themes. Don’t focus just on what was most frequent — provide value by interpreting *why* this matters.

4. Then, write an **"Opportunities"** section with **2-3 concrete, actionable marketing initiatives** derived from the insights (e.g., new campaigns, revised messaging, targeting ideas, partnerships, feature improvements).

5. Output must be in **strictly valid and structured JSON** format with the following keys:
   - "Categories": a summary of the responses (string) (limits to 540 letters)
   - "Insights": a list of 2-3 strategic insights (strings) (limits to 315 letters)
   - "Opportunities": a list of 2-3 suggested marketing actions (strings) (limits to 615 letters)

If responses are sparse or short, still do your best to cluster them meaningfully. Do not return empty outputs.

**Question:**  
"${question}"

**Responses:**  
(one response per line)
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
Given a survey question, its response data and its answer percentages, do these three things:

1. Create a table under the key "SummaryTable", with the following columns: "Response Option", "Response Count", and "Percentage". Include all the options from the input. Do not rank or comment on popularity. 
2. Under "Insights", provide 2-3 strategic observations or hypotheses derived from the distribution of responses. These should be non-obvious and marketing-relevant. Avoid mentioning which response was most common.
3. Under "Opportunities", suggest 2-3 marketing initiatives or tests that can be launched based on the insights. These may include campaign themes, segment targeting, or changes in messaging or product positioning.

Return strictly valid JSON with the following structure:
- "SummaryTable": a list of objects with keys "ResponseOption", "ResponseCount" (if available), and "Percentage"
- "Insights": a list of strategic insights (limits to 315 letters)
- "Opportunities": a list of actionable marketing ideas (limits to 615 letters)

Question:
"${question}"

Responses:
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
Based on these free-text survey responses from open-ended questions below, create a detailed Buyer Persona for the brand. The persona should include the following structured sections:

- "name": Create a representative name.
- "demographics": Age range, gender (if implied), occupation, income level (if inferred), and lifestyle context.
- "painPoints": Main frustrations, needs, or challenges reflected in the responses.
- "motivations": What drives this person to take action or seek this product.
- "goals": Their short- and long-term goals related to the product category.
- "behaviors": Typical habits, routines, and decision-making patterns.
- "personaSummary": A short paragraph describing this person's day-to-day life (limits to 400 letters), written in third person (e.g., “Maria is a busy mom in her 40s who…”).

Return strictly valid JSON with a single key: "Buyer Persona" containing all the structured sections above.

Survey Responses:
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
