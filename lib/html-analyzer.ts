interface AnalysisResult {
  nextSteps: Array<{
    selector: string
    action: string
    description: string
  }>
  currentContext: string
}

export function analyzeHtml(html: string): AnalysisResult {
  // Parse the HTML string
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, "text/html")

  // Determine the current context based on URL, title, or visible elements
  const title = doc.title || "Unknown page"

  // Find interactive elements that might be next steps
  const nextSteps: Array<{ selector: string; action: string; description: string }> = []

  // Check for forms
  const forms = doc.querySelectorAll("form")
  forms.forEach((form, index) => {
    const formId = form.id || `form-${index}`
    const submitButton = form.querySelector('button[type="submit"], input[type="submit"]')

    // Find empty required inputs
    const emptyRequiredInputs = form.querySelectorAll("input[required]:not([value])")

    if (emptyRequiredInputs.length > 0) {
      const firstInput = emptyRequiredInputs[0] as HTMLElement
      const inputId = firstInput.id || firstInput.getAttribute("name") || `input-${index}`

      nextSteps.push({
        selector: getUniqueSelector(firstInput),
        action: "fill",
        description: `Fill in the ${firstInput.getAttribute("placeholder") || inputId} field`,
      })
    } else if (submitButton) {
      nextSteps.push({
        selector: getUniqueSelector(submitButton as HTMLElement),
        action: "click",
        description: `Submit the ${formId} form`,
      })
    }
  })

  // Check for prominent buttons or links
  const buttons = doc.querySelectorAll('button:not([disabled]), a.btn, .button, [role="button"]')
  buttons.forEach((button, index) => {
    if (nextSteps.length < 5) {
      // Limit the number of suggested steps
      const buttonText = button.textContent?.trim() || `button-${index}`
      nextSteps.push({
        selector: getUniqueSelector(button as HTMLElement),
        action: "click",
        description: `Click the "${buttonText}" button`,
      })
    }
  })

  return {
    nextSteps,
    currentContext: `You are currently on: ${title}`,
  }
}

// Helper function to get a unique CSS selector for an element
function getUniqueSelector(element: HTMLElement): string {
  // Try ID first
  if (element.id) {
    return `#${element.id}`
  }

  // Try classes
  if (element.className) {
    const classNames = element.className.split(" ").filter((c) => c.trim().length > 0)
    if (classNames.length > 0) {
      return `.${classNames.join(".")}`
    }
  }

  // Try name attribute
  if (element.getAttribute("name")) {
    return `[name="${element.getAttribute("name")}"]`
  }

  // Fallback to tag name and position
  const tagName = element.tagName.toLowerCase()
  const siblings = Array.from(element.parentElement?.children || []).filter(
    (el) => el.tagName.toLowerCase() === tagName,
  )

  if (siblings.length > 1) {
    const index = siblings.indexOf(element)
    return `${tagName}:nth-of-type(${index + 1})`
  }

  return tagName
}
