;(() => {
  // Create a namespace for our assistant
  window.JourneyAssistant = window.JourneyAssistant || {}

  const MESSAGE_EVENT_TYPES = {
    HTML_RESPONSE: 'HTML_RESPONSE',
    GET_HTML: 'GET_HTML',
    HIGHLIGHT_ELEMENT: 'HIGHLIGHT_ELEMENT',
    NAVIGATION_EVENT: 'NAVIGATION_EVENT',
    GET_HTML_RESPONSE: 'GET_HTML_RESPONSE',
    CHATBOT_READY: 'CHATBOT_READY',
    CLEAR_HIGHLIGHT: 'CLEAR_HIGHLIGHT',
    NOTIFY_OF_COMPLETION: 'NOTIFY_OF_COMPLETION',
    REQUEST_INIT: 'REQUEST_INIT',
    INITIALIZE: 'INITIALIZE',
}
  window.JourneyAssistant.MESSAGE_EVENT_TYPES = MESSAGE_EVENT_TYPES

  // config object: will be merged in with config passed to init
  const config = {
    position: "bottom-right",
    width: "350px",
    height: "500px",
    borderRadius: "8px",
    zIndex: 9999,
    onCloseCallback: null,
    assistantUrl: null,
    geminiApiKey: null,
    agentAdditionalInformation: null,
    getCurrentHtml: null, // Function to get current HTML, if not provided uses document.documentElement.outerHTML
  }

  // Store references to elements
  const highlightElId = "journey-assistant-highlight"
  let iframe = null
  let highlightEl = null
  let tooltipEl = null
  let iframeContainer = null
  let highlightElTarget = null
  let scrollHandler = null
  let isDragging = false
  let isResizing = false
  let startX = 0
  let startY = 0
  let startWidth = 0
  let startHeight = 0
  let startLeft = 0
  let startTop = 0

  // Utility functions
  function warnIframeGone() {
    console.warn("Iframe is not available.")
  }

  // Tooltip positioning functions
  function getTooltipPosition(elementRect, tooltipHeight, tooltipWidth) {
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const padding = 10;
    
    const spaceAbove = elementRect.top;
    const spaceBelow = viewportHeight - elementRect.bottom;
    const spaceLeft = elementRect.left;
    const spaceRight = viewportWidth - elementRect.right;
    
    const spaces = [
      { dir: 'top', space: spaceAbove, required: tooltipHeight + padding },
      { dir: 'bottom', space: spaceBelow, required: tooltipHeight + padding },
      { dir: 'left', space: spaceLeft, required: tooltipWidth + padding },
      { dir: 'right', space: spaceRight, required: tooltipWidth + padding }
    ].filter(({space, required}) => space >= required);

    spaces.sort((a, b) => b.space - a.space);
    const position = spaces[0]?.dir || 'top';
    
    let top, left;

    const calculateHorizontalPosition = (baseLeft) => {
      let finalLeft = baseLeft;
      let offset = 0;
      
      if (finalLeft + tooltipWidth > viewportWidth - padding) {
        offset = viewportWidth - padding - (finalLeft + tooltipWidth);
        finalLeft += offset;
      }
      
      if (finalLeft < padding) {
        offset = padding - finalLeft;
        finalLeft = padding;
      }
      
      return { finalLeft, arrowOffset: -offset };
    };

    const calculateVerticalPosition = (baseTop) => {
      let finalTop = baseTop;
      let offset = 0;
      
      if (finalTop + tooltipHeight > viewportHeight - padding) {
        offset = viewportHeight - padding - (finalTop + tooltipHeight);
        finalTop += offset;
      }
      
      if (finalTop < padding) {
        offset = padding - finalTop;
        finalTop = padding;
      }
      
      return { finalTop, arrowOffset: -offset };
    };
    
    switch (position) {
      case 'top':
      case 'bottom': {
        const baseLeft = elementRect.left + (elementRect.width / 2) - (tooltipWidth / 2);
        const { finalLeft, arrowOffset } = calculateHorizontalPosition(baseLeft);
        left = finalLeft;
        
        if (position === 'top') {
          const baseTop = elementRect.top - tooltipHeight - padding;
          top = Math.max(padding, baseTop);
        } else {
          const baseTop = elementRect.bottom + padding;
          top = Math.min(viewportHeight - tooltipHeight - padding, baseTop);
        }
        
        return { top, left, position, arrowOffset, transform: 'none' };
      }
      case 'left':
      case 'right': {
        const baseTop = elementRect.top + (elementRect.height / 2) - (tooltipHeight / 2);
        const { finalTop, arrowOffset } = calculateVerticalPosition(baseTop);
        top = finalTop;
        
        if (position === 'left') {
          const baseLeft = elementRect.left - tooltipWidth - padding;
          left = Math.max(padding, baseLeft);
        } else {
          const baseLeft = elementRect.right + padding;
          left = Math.min(viewportWidth - tooltipWidth - padding, baseLeft);
        }
        
        return { top, left, position, arrowOffset, transform: 'none' };
      }
    }
  }

  function updateHighlightPosition() {
    if (!highlightElTarget || !highlightEl || !tooltipEl) return;

    const rect = highlightElTarget.getBoundingClientRect();
    
    highlightEl.style.top = `${rect.top}px`;
    highlightEl.style.left = `${rect.left}px`;
    highlightEl.style.width = `${rect.width}px`;
    highlightEl.style.height = `${rect.height}px`;

    const tooltipPos = getTooltipPosition(rect, tooltipEl.offsetHeight, tooltipEl.offsetWidth);
    
    tooltipEl.style.top = `${tooltipPos.top}px`;
    tooltipEl.style.left = `${tooltipPos.left}px`;
    tooltipEl.style.transform = tooltipPos.transform || 'none';
    tooltipEl.style.setProperty('--arrow-offset', `${tooltipPos.arrowOffset || 0}px`);
    tooltipEl.className = `journey-tooltip tooltip-${tooltipPos.position}`;
  }

  function createTooltipContent(tooltipEl, description) {
    const contentDiv = document.createElement("div")
    contentDiv.className = "journey-tooltip-content"
    contentDiv.textContent = description

    const buttonsDiv = document.createElement("div")
    buttonsDiv.className = "journey-tooltip-buttons"

    const nextButton = document.createElement("button")
    nextButton.className = "journey-tooltip-button"
    nextButton.textContent = "Next"
    nextButton.onclick = () => {
      window.JourneyAssistant.notifyOfNavigation()
    }

    const doneButton = document.createElement("button")
    doneButton.className = "journey-tooltip-button"
    doneButton.textContent = "Done"
    doneButton.onclick = () => {
      window.JourneyAssistant.notifyOfCompletion()
    }

    buttonsDiv.appendChild(nextButton)
    buttonsDiv.appendChild(doneButton)
    tooltipEl.appendChild(contentDiv)
    tooltipEl.appendChild(buttonsDiv)
  }

  // Message handling functions
  function handleMessage(event) {
    if (!iframe || !event.source === iframe.contentWindow) return warnIframeGone()

    const { type, data } = event.data

    switch (type) {
      case MESSAGE_EVENT_TYPES.GET_HTML:
        sendHtmlToIframe(data.messageId)
        break
      case MESSAGE_EVENT_TYPES.HIGHLIGHT_ELEMENT:
        highlightElement(data.selector, data.description, data.menuSelectorToExpand)
        break
      case MESSAGE_EVENT_TYPES.CLEAR_HIGHLIGHT:
        clearHighlight()
        break
    }
  }

  function getCurrentHtml() {
    if (config.getCurrentHtml) {
      return config.getCurrentHtml()
    }
    return document.documentElement.outerHTML
  }

  function sendHtmlToIframe(messageId) {
    if (!iframe) return warnIframeGone()

    const html = getCurrentHtml()
    iframe.contentWindow.postMessage(
      {
        type: MESSAGE_EVENT_TYPES.GET_HTML_RESPONSE,
        html,
        messageId,
      },
      "*",
    )
  }

  // Highlight management functions
  function highlightElement(selector, description, menuSelectorToExpand) {
    try {
      clearHighlight()

      const element = document.querySelector(selector)
      if (!element) {
        console.warn(`Element not found: ${selector}`)
        return
      }

      if (menuSelectorToExpand) {
        const menuElement = document.querySelector(menuSelectorToExpand)
        if (menuElement) {
          menuElement.click()
        } else {
          console.warn(`Menu element not found: ${menuSelectorToExpand}`)
        }
      }

      const rect = element.getBoundingClientRect()
      if (!rect) {
        console.warn(`Element not found: ${selector}`)
        return
      }
      highlightElTarget = element

      if (description && HTMLElement.prototype.hasOwnProperty('popover')) {
        tooltipEl = document.createElement("div")
        tooltipEl.className = "journey-tooltip"
        tooltipEl.setAttribute("role", "tooltip")
        tooltipEl.setAttribute("id", highlightElId)
        tooltipEl.popover = "manual"
        tooltipEl.setAttribute("popover", "manual")
        document.body.appendChild(tooltipEl)
        
        createTooltipContent(tooltipEl, description)
        
        const tooltipPos = getTooltipPosition(rect, tooltipEl.offsetHeight, tooltipEl.offsetWidth);
        
        tooltipEl.style.position = "fixed"
        tooltipEl.style.top = `${tooltipPos.top}px`
        tooltipEl.style.left = `${tooltipPos.left}px`
        tooltipEl.style.transform = tooltipPos.transform
        tooltipEl.className = `journey-tooltip tooltip-${tooltipPos.position}`
        tooltipEl.showPopover()
      } else if (description) {
        tooltipEl = document.createElement("div")
        tooltipEl.className = "journey-tooltip"
        tooltipEl.style.position = "fixed"
        
        document.body.appendChild(tooltipEl)
        
        createTooltipContent(tooltipEl, description)
        
        const tooltipPos = getTooltipPosition(rect, tooltipEl.offsetHeight, tooltipEl.offsetWidth);
        
        tooltipEl.style.top = `${tooltipPos.top}px`
        tooltipEl.style.left = `${tooltipPos.left}px`
        tooltipEl.style.transform = tooltipPos.transform
        tooltipEl.className = `journey-tooltip tooltip-${tooltipPos.position}`
      }

      highlightEl = document.createElement("div")
      highlightEl.className = "journey-highlight"
      highlightEl.style.position = "fixed"
      highlightEl.style.top = `${rect.top}px`
      highlightEl.style.left = `${rect.left}px`
      highlightEl.style.width = `${rect.width}px`
      highlightEl.style.height = `${rect.height}px`

      document.body.appendChild(highlightEl)

      scrollHandler = () => {
        window.requestAnimationFrame(updateHighlightPosition);
      };
      window.addEventListener("scroll", scrollHandler, { passive: true });

      element.scrollIntoView({ behavior: "smooth", block: "center" })
    } catch (error) {
      console.error("Error highlighting element:", error)
    }
  }

  function clearHighlight() {
    if (scrollHandler) {
      window.removeEventListener("scroll", scrollHandler, { passive: true });
      scrollHandler = null;
    }

    highlightElTarget = null;
    if (highlightEl) {
      highlightEl.remove()
      highlightEl = null
    }

    if (tooltipEl) {
      tooltipEl.remove()
      tooltipEl = null
    }
  }

  // Drag and resize handlers
  function handleDragStart(e) {
    if (e.target.closest('.journey-iframe-close') || e.target.closest('.journey-iframe-resize')) {
      return;
    }
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startLeft = iframeContainer.offsetLeft;
    startTop = iframeContainer.offsetTop;
    iframeContainer.style.transition = 'none';
  }

  function handleResize(e) {
    isResizing = true;
    startX = e.clientX;
    startY = e.clientY;
    startWidth = iframeContainer.offsetWidth;
    startHeight = iframeContainer.offsetHeight;
    iframeContainer.style.transition = 'none';
  }

  function handleMove(e) {
    if (!isDragging && !isResizing) return;

    if (isDragging) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      
      const newLeft = startLeft + dx;
      const newTop = startTop + dy;
      
      const maxX = window.innerWidth - iframeContainer.offsetWidth;
      const maxY = window.innerHeight - iframeContainer.offsetHeight;
      
      iframeContainer.style.left = `${Math.max(0, Math.min(maxX, newLeft))}px`;
      iframeContainer.style.top = `${Math.max(0, Math.min(maxY, newTop))}px`;
    }

    if (isResizing) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      
      const newWidth = Math.max(300, startWidth + dx);
      const newHeight = Math.max(200, startHeight + dy);
      
      const maxWidth = window.innerWidth - iframeContainer.offsetLeft;
      const maxHeight = window.innerHeight - iframeContainer.offsetTop;
      
      iframeContainer.style.width = `${Math.min(maxWidth, newWidth)}px`;
      iframeContainer.style.height = `${Math.min(maxHeight, newHeight)}px`;
    }
  }

  function handleEnd() {
    isDragging = false;
    isResizing = false;
    if (iframeContainer) {
      iframeContainer.style.transition = 'all 0.3s ease';
    }
  }

  const globalCss = `

  /* Tooltip styles for the journey assistant */
  .journey-tooltip {
    position: fixed;
    background-color: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 14px;
    max-width: 300px;
    z-index: 10000;
    pointer-events: all;
    animation: fadeIn 0.3s ease-out;
    margin: 0;
    white-space: normal;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .journey-tooltip-content {
    pointer-events: none;
  }

  .journey-tooltip-buttons {
    display: flex;
    gap: 8px;
    justify-content: center;
    margin-top: 8px;
  }

  .journey-tooltip-button {
    background-color: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.4);
    color: white;
    padding: 4px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s ease;
  }

  .journey-tooltip-button:hover {
    background-color: rgba(255, 255, 255, 0.3);
    border-color: rgba(255, 255, 255, 0.5);
  }

  /* Position-specific tooltip styles */
  .journey-tooltip::after {
    content: '';
    position: absolute;
    border: 5px solid transparent;
  }

  .journey-tooltip.tooltip-top::after {
    bottom: -10px;
    border-top-color: rgba(0, 0, 0, 0.8);
  }

  .journey-tooltip.tooltip-bottom::after {
    top: -10px;
    border-bottom-color: rgba(0, 0, 0, 0.8);
  }

  .journey-tooltip.tooltip-left::after {
    right: -10px;
    border-left-color: rgba(0, 0, 0, 0.8);
  }

  .journey-tooltip.tooltip-right::after {
    left: -10px;
    border-right-color: rgba(0, 0, 0, 0.8);
  }
  
  /* Arrow positioning for top/bottom tooltips */
  .journey-tooltip.tooltip-top::after,
  .journey-tooltip.tooltip-bottom::after {
    left: calc(50% - 5px);
    transform: translateX(var(--arrow-offset, 0px));
  }
  
  /* Arrow positioning for left/right tooltips */
  .journey-tooltip.tooltip-left::after,
  .journey-tooltip.tooltip-right::after {
    top: calc(50% - 5px);
    transform: translateY(var(--arrow-offset, 0px));
  }

  .journey-highlight {
    position: fixed;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5), 0 0 0 4px rgba(59, 130, 246, 0.3);
    border-radius: 4px;
    z-index: 9999;
    pointer-events: none;
    animation: pulse 2s infinite;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes pulse {
    0% {
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5), 0 0 0 4px rgba(59, 130, 246, 0.3);
    }
    50% {
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.8), 0 0 0 6px rgba(59, 130, 246, 0.5);
    }
    100% {
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5), 0 0 0 4px rgba(59, 130, 246, 0.3);
    }
  }

  .journey-iframe-container {
    min-width: 300px;
    min-height: 200px;
  }

  .journey-iframe-header {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 30px;
    background: rgba(0, 0, 0, 0.1);
    cursor: move;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: 0 8px;
  }

  .journey-iframe-close {
    width: 20px;
    height: 20px;
    border: none;
    background: transparent;
    color: rgba(0, 0, 0, 0.6);
    cursor: pointer;
    font-size: 20px;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    margin: 0;
    transition: color 0.2s ease;
  }

  .journey-iframe-close:hover {
    color: rgba(0, 0, 0, 0.8);
  }

  .journey-iframe-resize {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 15px;
    height: 15px;
    cursor: nwse-resize;
    background: linear-gradient(
      135deg,
      transparent 0%,
      transparent 50%,
      rgba(0, 0, 0, 0.2) 50%,
      rgba(0, 0, 0, 0.2) 100%
    );
  }

  .journey-iframe-content {
    position: absolute;
    top: 30px;
    left: 0;
    right: 0;
    bottom: 0;
    overflow: hidden;
  }
  `
  // Append global CSS to the document
  const style = document.createElement("style")
  style.setAttribute("type", "text/css")
  style.appendChild(document.createTextNode(globalCss))
  document.head.appendChild(style)



  // Public API functions
  window.JourneyAssistant.init = (initConfig = {}) => {
    // Merge default config with user config
    Object.assign(config, initConfig)
    // ensure assistantUrl is set
    if (!config.assistantUrl) {
      console.dir(config)
      console.dir(initConfig)
      console.error("assistantUrl is required to initialize the Journey Assistant.")
      return
    }

    // Create container for the iframe
    iframeContainer = document.createElement("div")
    iframeContainer.className = "journey-iframe-container"
    iframeContainer.style.position = "fixed"
    iframeContainer.style.width = config.width
    iframeContainer.style.height = config.height
    iframeContainer.style.zIndex = config.zIndex
    iframeContainer.style.borderRadius = config.borderRadius
    iframeContainer.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.15)";
    iframeContainer.style.backgroundColor = "white"
    iframeContainer.style.transition = "all 0.3s ease"

    // Create header for dragging
    const header = document.createElement("div")
    header.className = "journey-iframe-header"
    
    // Create close button
    const closeButton = document.createElement("button")
    closeButton.className = "journey-iframe-close"
    closeButton.innerHTML = "×"
    closeButton.onclick = () => {
      iframeContainer.remove();
      if (config.onCloseCallback) config.onCloseCallback();
    }
    header.appendChild(closeButton)

    // Create content container
    const content = document.createElement("div")
    content.className = "journey-iframe-content"

    // Create resize handle
    const resizeHandle = document.createElement("div")
    resizeHandle.className = "journey-iframe-resize"

    // Create the iframe
    iframe = document.createElement("iframe")
    iframe.src = config.assistantUrl
    iframe.style.width = "100%"
    iframe.style.height = "100%"
    iframe.style.border = "none"
    iframe.style.borderRadius = config.borderRadius

    // Add iframe to content container
    content.appendChild(iframe)

    // Add all elements to container
    iframeContainer.appendChild(header)
    iframeContainer.appendChild(content)
    iframeContainer.appendChild(resizeHandle)

    // Position the container
    switch (config.position) {
      case "bottom-right":
        iframeContainer.style.bottom = "20px"
        iframeContainer.style.right = "20px"
        break;
      case "bottom-left":
        iframeContainer.style.bottom = "20px"
        iframeContainer.style.left = "20px"
        break;
      case "top-right":
        iframeContainer.style.top = "20px"
        iframeContainer.style.right = "20px"
        break;
      case "top-left":
        iframeContainer.style.top = "20px"
        iframeContainer.style.left = "20px"
        break;
    };

    // Add container to body
    document.body.appendChild(iframeContainer)

    // Set up message listener for communication with iframe
    window.addEventListener("message", handleMessage);

    // Set up drag and resize handlers
    header.addEventListener('mousedown', handleDragStart);
    resizeHandle.addEventListener('mousedown', handleResize);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('mouseleave', handleEnd);
    return iframe
  }

  function warnIframeGone() {
    console.warn("Iframe is not available.")
  }

  // Handle messages from the iframe
  function handleMessage(event) {
    // Verify the origin matches our assistant
    if (!iframe || !event.source === iframe.contentWindow) return warnIframeGone()

    const { type, data } = event.data

    // console.log("Received message from iframe:", type, data)
    // console.dir(event)

    switch (type) {
      case MESSAGE_EVENT_TYPES.GET_HTML:
        sendHtmlToIframe(data.messageId)
        break
      case MESSAGE_EVENT_TYPES.HIGHLIGHT_ELEMENT:
        highlightElement(data.selector, data.description, data.menuSelectorToExpand)
        break
      case MESSAGE_EVENT_TYPES.CLEAR_HIGHLIGHT:
        clearHighlight()
        break
      case MESSAGE_EVENT_TYPES.REQUEST_INIT:
        iframe.contentWindow.postMessage(
          {
            type: MESSAGE_EVENT_TYPES.INITIALIZE,
            data: {
              apiKey: config.geminiApiKey,
              agentAdditionalInformation: config.agentAdditionalInformation,
            },
          },
          "*"
        )
        break
    }
  }

  // Send the current HTML to the iframe
  function sendHtmlToIframe(messageId) {
    if (!iframe) return warnIframeGone()

    const html = config.getCurrentHtml ? config.getCurrentHtml() : document.documentElement.outerHTML
    iframe.contentWindow.postMessage(
      {
        type: MESSAGE_EVENT_TYPES.GET_HTML_RESPONSE,
        html,
        messageId,
      },
      "*",
    )
  }

  // Highlight an element on the page
  window.JourneyAssistant.highlight = (selector, description) => {
    highlightElement(selector, description)
  }

  // Clear any active highlights
  window.JourneyAssistant.clearHighlight = () => {
    clearHighlight()
  }

  // Notify the assistant of completion
  window.JourneyAssistant.notifyOfCompletion = () => {
    if (!iframe) return warnIframeGone()
    // console.log("Sending completion event to iframe")
    iframe.contentWindow.postMessage(
      {
        type: MESSAGE_EVENT_TYPES.NOTIFY_OF_COMPLETION,
      },
      "*",
    )
    clearHighlight()
  }

  // Notify the assistant of an event
  window.JourneyAssistant.notifyOfNavigation = () => {
    if (!iframe) return warnIframeGone()
    const html = getCurrentHtml()
    const data = {
      html,
      url: window.location.href,
      title: document.title,
    }
    // console.log("Sending navigation event to iframe:", data)
    iframe.contentWindow.postMessage(
      {
        type: MESSAGE_EVENT_TYPES.NAVIGATION_EVENT,
        data,
      },
      "*",
    )
  }

  function createTooltipContent(tooltipEl, description) {
    // Create content container
    const contentDiv = document.createElement("div")
    contentDiv.className = "journey-tooltip-content"
    contentDiv.textContent = description

    // Create buttons container
    const buttonsDiv = document.createElement("div")
    buttonsDiv.className = "journey-tooltip-buttons"

    // Create Next button
    const nextButton = document.createElement("button")
    nextButton.className = "journey-tooltip-button"
    nextButton.textContent = "Next"
    nextButton.onclick = () => {
      window.JourneyAssistant.notifyOfNavigation()
    }

    // Create Done button
    const doneButton = document.createElement("button")
    doneButton.className = "journey-tooltip-button"
    doneButton.textContent = "Done"
    doneButton.onclick = () => {
      window.JourneyAssistant.notifyOfCompletion()
    }

    // Add buttons to container
    buttonsDiv.appendChild(nextButton)
    buttonsDiv.appendChild(doneButton)

    // Add content and buttons to tooltip
    tooltipEl.appendChild(contentDiv)
    tooltipEl.appendChild(buttonsDiv)
  }

  // Implementation of highlightElement
  function highlightElement(selector, description, menuSelectorToExpand) {
    try {
      // Clear any existing highlights
      clearHighlight()

      // Find the element
      const element = document.querySelector(selector)
      if (!element) {
        console.warn(`Element not found: ${selector}`)
        return
      }

      // Optionally expand a menu
      if (menuSelectorToExpand) {
        const menuElement = document.querySelector(menuSelectorToExpand)
        if (menuElement) {
          menuElement.click()
        } else {
          console.warn(`Menu element not found: ${menuSelectorToExpand}`)
        }
      }

      // Get element position
      const rect = element.getBoundingClientRect()
      if (!rect) {
        console.warn(`Element not found: ${selector}`)
        return
      }
      highlightElTarget = element

      // Create tooltip using the Popover API if available
      if (description && HTMLElement.prototype.hasOwnProperty('popover')) {
        tooltipEl = document.createElement("div")
        tooltipEl.className = "journey-tooltip"
        tooltipEl.setAttribute("role", "tooltip")
        tooltipEl.setAttribute("id", highlightElId)
        tooltipEl.popover = "manual"
        tooltipEl.setAttribute("popover", "manual")
        document.body.appendChild(tooltipEl)
        
        // Add content and buttons
        createTooltipContent(tooltipEl, description)
        
        // Get optimal tooltip position after element is in DOM
        const tooltipPos = getTooltipPosition(rect, tooltipEl.offsetHeight, tooltipEl.offsetWidth);
        
        tooltipEl.style.position = "fixed"
        tooltipEl.style.top = `${tooltipPos.top}px`
        tooltipEl.style.left = `${tooltipPos.left}px`
        tooltipEl.style.transform = tooltipPos.transform
        tooltipEl.className = `journey-tooltip tooltip-${tooltipPos.position}`
        tooltipEl.showPopover()
      } else if (description) {
        // Fallback to legacy tooltip
        tooltipEl = document.createElement("div")
        tooltipEl.className = "journey-tooltip"
        tooltipEl.style.position = "fixed"
        
        document.body.appendChild(tooltipEl)
        
        // Add content and buttons
        createTooltipContent(tooltipEl, description)
        
        // Get optimal tooltip position after element is in DOM
        const tooltipPos = getTooltipPosition(rect, tooltipEl.offsetHeight, tooltipEl.offsetWidth);
        
        tooltipEl.style.top = `${tooltipPos.top}px`
        tooltipEl.style.left = `${tooltipPos.left}px`
        tooltipEl.style.transform = tooltipPos.transform
        tooltipEl.className = `journey-tooltip tooltip-${tooltipPos.position}`
      }

      // Create highlight element with fixed positioning
      highlightEl = document.createElement("div")
      highlightEl.className = "journey-highlight"
      highlightEl.style.position = "fixed"
      highlightEl.style.top = `${rect.top}px`
      highlightEl.style.left = `${rect.left}px`
      highlightEl.style.width = `${rect.width}px`
      highlightEl.style.height = `${rect.height}px`

      // Add highlight to the page
      document.body.appendChild(highlightEl)

      // Add scroll listener with passive option
      scrollHandler = () => {
        window.requestAnimationFrame(updateHighlightPosition);
      };
      window.addEventListener("scroll", scrollHandler, { passive: true });

      // Scroll element into view if needed
      element.scrollIntoView({ behavior: "smooth", block: "center" })
    } catch (error) {
      console.error("Error highlighting element:", error)
    }
  }

  // Clear highlight and tooltip
  function clearHighlight() {
    if (scrollHandler) {
      window.removeEventListener("scroll", scrollHandler, { passive: true });
      scrollHandler = null;
    }

    highlightElTarget = null;
    if (highlightEl) {
      highlightEl.remove()
      highlightEl = null
    }

    if (tooltipEl) {
      tooltipEl.remove()
      tooltipEl = null
    }
  };
})()
