import PPT_Template from "ppt-template"

const TEMPLATE = "tmp/template.pptx"
const OUTPUT = "tmp/survey.pptx"

const { Presentation, Slide } = PPT_Template

const formatList = (items) => {
  if (!items) return ""
  if (Array.isArray(items)) return items.join("\n")
  if (typeof items === "object") {
    return Object.entries(items)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n")
  }
  return String(items)
}

const fillPersonaSlide = (slide, persona) => {
  if (typeof persona === "string") {
    persona = JSON.parse(persona)
  }

  const {
    name = "",
    demographics = {},
    motivations = [],
    goals = [],
    behaviors = [],
    painPoints = [],
    personaSummary = "",
  } = persona

  const { occupation = "", lifestyleContext = "", ageRange = "" } = demographics

  slide.fillAll([
    Slide.pair("[Name]", name),
    Slide.pair("[Age]", ageRange),
    Slide.pair("[Occupation]", occupation),
    Slide.pair("[Lifestyle]", lifestyleContext),
    Slide.pair("[Motivations]", formatList(motivations)),
    Slide.pair("[Goals]", formatList(goals)),
    Slide.pair("[Behaviors]", formatList(behaviors)),
    Slide.pair("[Points]", formatList(painPoints)),
    Slide.pair("[Life]", formatList(personaSummary)),
  ])
}

const fillQuestionSlide = (slide, question, payload) => {
  slide.fillAll([
    Slide.pair("[Question]", question || ""),
    Slide.pair("[Results]", formatList(payload.categories)),
    Slide.pair("[Insights]", formatList(payload.insights)),
    Slide.pair("[Opportunities]", formatList(payload.opportunities)),
  ])
}

export const generatePresentation = async (data) => {
  const pres = new Presentation()
  await pres.loadFile(TEMPLATE)

  const introSlides = [1, 2].map((i) => pres.getSlide(i))

  const questionSlideTemplate = pres.getSlide(3)
  const personaSlideTemplate = pres.getSlide(4)

  const questionSlides = []
  let personaSlide = null

  for (const [question, payload] of Object.entries(data)) {
    if (question === "Buyer Persona") {
      const slide = personaSlideTemplate.clone()
      fillPersonaSlide(slide, payload.persona)
      personaSlide = slide
    } else {
      const slide = questionSlideTemplate.clone()
      fillQuestionSlide(slide, question, payload)
      questionSlides.push(slide)
    }
  }

  const finalSlides = [...introSlides, ...questionSlides]
  if (personaSlide) {
    finalSlides.push(personaSlide)
  }

  console.log("Generando presentación final con slides modificadas...")
  const newPres = await pres.generate(finalSlides)
  await newPres.saveAs(OUTPUT)
  console.log(`Presentación guardada en: ${OUTPUT}`)
}
