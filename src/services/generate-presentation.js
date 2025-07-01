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
  if (typeof persona === "string") {
    persona = JSON.parse(persona)
  }

  const {
    name,
    demographics,
    motivations,
    goals,
    behaviors,
    painPoints,
    personaSummary,
  } = persona
  const { occupation, lifestyleContext, ageRange } = demographics

  slide.fillAll([
    Slide.pair("[Name]", name),
    Slide.pair("[Age]", ageRange),
    Slide.pair("[Occupation]", occupation),
    Slide.pair("[Lifestyle]", lifestyleContext),
    Slide.pair("[Motivations]", formatList(motivations)),
    Slide.pair("[Goals]", formatList(goals)),
    Slide.pair("[Behaviors]", formatList(behaviors)),
    Slide.pair("[Points]", formatList(painPoints)),
    Slide.pair("[Life]", personaSummary),
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

    // console.log(payload)

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
