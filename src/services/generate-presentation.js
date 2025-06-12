import PPT_Template from "ppt-template"

const TEMPLATE = "template.pptx"
const OUTPUT = "tmp/survey.pptx"

const { Presentation, Slide } = PPT_Template

const formatList = (items) => {
  if (!items) return ""
  return Array.isArray(items)
    ? items.join("\n")
    : typeof items === "object"
    ? Object.entries(items)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n")
    : String(items)
}

const fillPersonaSlide = (slide, persona) => {
  const {
    name,
    demographics,
    motivations,
    goals,
    typical_behaviors,
    pain_points,
    daily_life,
  } = persona
  const { age_range, occupation, lifestyle } = demographics

  slide.fillAll([
    Slide.pair("[Name]", name),
    Slide.pair("[Age]", age_range),
    Slide.pair("[Occupation]", occupation),
    Slide.pair("[Lifestyle]", lifestyle),
    Slide.pair("[Motivations]", formatList(motivations)),
    Slide.pair("[Goals]", formatList(goals)),
    Slide.pair("[Behaviors]", formatList(typical_behaviors)),
    Slide.pair("[Points]", formatList(pain_points)),
    Slide.pair("[Life]", daily_life),
  ])
}

const fillQuestionSlide = (slide, question, payload) => {
  slide.fillAll([
    Slide.pair("[Question]", question),
    Slide.pair("[Results]", formatList(payload.categories)),
    Slide.pair("[Insights]", formatList(payload.insights)),
    Slide.pair("[Opportunities]", formatList(payload.opportunities)),
  ])
}

export const generatePresentation = async (data) => {
  const pres = new Presentation()
  await pres.loadFile(TEMPLATE)

  // Slides intro (1 y 2) + contenido dinámico
  const introSlides = [1, 2].map((i) => pres.getSlide(i))
  const contentSlides = Object.entries(data).map(([question, payload], idx) => {
    const slideIndex = idx + 3
    const slide = pres.getSlide(slideIndex).clone()

    if (question === "Buyer Persona") {
      fillPersonaSlide(slide, payload.persona)
    } else {
      fillQuestionSlide(slide, question, payload)
    }

    return slide
  })

  console.log("Generando presentación final con slides modificadas...")
  const finalSlides = [...introSlides, ...contentSlides]
  const newPres = await pres.generate(finalSlides)
  await newPres.saveAs(OUTPUT)

  console.log(`Presentación guardada en: ${OUTPUT}`)
}
