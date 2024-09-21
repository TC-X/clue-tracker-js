// Refactored clue-tracker
;(function () {
  if (typeof window === 'undefined') return

  const TRACKING_ENDPOINT = 'https://your-server.com/track'

  // Utility functions
  const utils = {
    generateUUID: function () {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
        /[xy]/g,
        function (c) {
          var r = (Math.random() * 16) | 0,
            v = c == 'x' ? r : (r & 0x3) | 0x8
          return v.toString(16)
        }
      )
    },

    sendData: function (data) {
      // Uncomment the following lines to actually send data to the server
      // fetch(TRACKING_ENDPOINT, {
      //   method: 'POST',
      //   body: JSON.stringify(data),
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      // }).catch(console.error)

      console.log(data)
    },

    getSessionId: function () {
      return localStorage.getItem('sessionId') || this.generateUUID()
    },

    getUserConsent: function () {
      return localStorage.getItem('ctmConsent') === 'true'
    },

    setUserConsent: function (consent) {
      localStorage.setItem('ctmConsent', consent.toString())
    },

    showConsentBanner: function () {
      // Implement a user-friendly consent banner
      const style = document.createElement('style')
      style.innerHTML = `
        .ctm-consent-banner {
          margin: 24px;
          position: fixed;
          max-width: 600px;
          bottom: 0;
          left: 0;
          border-radius: 16px;
          box-shadow: 0 0 8px rgba(0, 0, 0, 0.01);
          overflow: hidden;
        }

        .ctm-consent-banner .container {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 24px;
          background: #fff;
        }

        .ctm-consent-banner .button-wrapper {
          display: flex;
          gap: 8px;
        }

        .ctm-consent-banner .button {
          font-weight: bold;
          padding: 8px 16px;
          border-radius: 8px;
          transition: opacity 0.3s;
        }

        .ctm-consent-banner .button.accept {
          background: #000;
          color: #fff;
        }

        .ctm-consent-banner .button:hover {
          opacity: 0.6;
        }
      `
      const banner = document.createElement('div')
      banner.classList.add('ctm-consent-banner')
      banner.innerHTML = `
      <div class="container">
        <p>We use cookies and similar technologies to improve your browsing experience and personalize content. 
        By continuing to use our site, you agree to our use of cookies. To learn more, please read our Privacy Policy.</p>
        <div class="button-wrapper">
        <button id="accept-consent" class="button accept">Accept</button>
          <button id="decline-consent" class="button decline">Decline</button>
        </div>
      </div>
      `

      banner.prepend(style)
      document.body.appendChild(banner)

      document
        .getElementById('accept-consent')
        .addEventListener('click', () => {
          console.log('User accepted consent')
          this.setUserConsent(true)
          banner.remove()
          initializeTracker()
        })

      document
        .getElementById('decline-consent')
        .addEventListener('click', () => {
          console.log('User declined consent')
          this.setUserConsent(false)
          banner.remove()
        })
    },
  }

  // Tracking modules
  const trackingModules = {
    pageView: function () {
      let currentPath = window.location.pathname

      function trackPageView() {
        const data = {
          event: 'pageview',
          url: window.location.href,
          referrer: document.referrer,
          userAgent: navigator.userAgent,
          screenSize: `${window.screen.width}x${window.screen.height}`,
          timestamp: new Date().toISOString(),
          sessionId: utils.getSessionId(),
        }

        localStorage.setItem('sessionId', data.sessionId)
        utils.sendData(data)
      }

      function setupPageViewTracking() {
        trackPageView()

        const observer = new MutationObserver((mutations) => {
          if (window.location.pathname !== currentPath) {
            currentPath = window.location.pathname
            trackPageView()
          }
        })

        observer.observe(document, { subtree: true, childList: true })
        window.addEventListener('popstate', trackPageView)
      }

      return { init: setupPageViewTracking }
    },

    click: function () {
      function trackClick(event) {
        const data = {
          event: 'click',
          url: window.location.href,
          element: event.target.tagName,
          elementId: event.target.id,
          elementClass: event.target.className,
          elementText: event.target.innerText,
          x: event.clientX,
          y: event.clientY,
          timestamp: new Date().toISOString(),
          sessionId: utils.getSessionId(),
        }

        utils.sendData(data)
      }

      return {
        init: function () {
          document.addEventListener('click', trackClick)
        },
      }
    },

    scroll: function () {
      const scrollableElements = new Map()

      function calculateScrollDepth(element) {
        const scrollHeight = element.scrollHeight - element.clientHeight
        const scrollTop = element.scrollTop
        return scrollHeight > 0
          ? Math.round((scrollTop / scrollHeight) * 100)
          : 0
      }

      function trackScroll(event) {
        const target = event.target
        const isDocument = target === document
        const element = isDocument
          ? document.scrollingElement || document.documentElement
          : target
        const currentScrollDepth = calculateScrollDepth(element)

        let elementInfo = scrollableElements.get(element)
        if (!elementInfo) {
          elementInfo = { lastScrollDepth: 0, lastTrackedDepth: 0 }
          scrollableElements.set(element, elementInfo)
        }

        const scrollDifference = Math.abs(
          currentScrollDepth - elementInfo.lastTrackedDepth
        )
        const scrollDirection =
          currentScrollDepth > elementInfo.lastScrollDepth ? 'down' : 'up'

        if (scrollDifference >= 10) {
          elementInfo.lastTrackedDepth = currentScrollDepth
          utils.sendData({
            event: 'scroll_depth',
            depth: currentScrollDepth,
            direction: scrollDirection,
            elementId: isDocument ? 'document' : element.id,
            elementClass: isDocument ? '' : element.className,
            url: window.location.href,
            path: window.location.pathname,
            timestamp: new Date().toISOString(),
            sessionId: utils.getSessionId(),
          })
        }

        elementInfo.lastScrollDepth = currentScrollDepth
      }

      function findScrollableElements(element) {
        const style = window.getComputedStyle(element)
        const overflowY = style.getPropertyValue('overflow-y')
        if (overflowY === 'scroll' || overflowY === 'auto') {
          element.addEventListener('scroll', trackScroll, { passive: true })
        }
        for (let child of element.children) {
          findScrollableElements(child)
        }
      }

      function setupScrollTracking() {
        window.addEventListener('scroll', trackScroll, { passive: true })
        findScrollableElements(document.body)

        const observer = new MutationObserver((mutations) => {
          for (let mutation of mutations) {
            for (let node of mutation.addedNodes) {
              if (node.nodeType === Node.ELEMENT_NODE) {
                findScrollableElements(node)
              }
            }
          }
        })

        observer.observe(document.body, { childList: true, subtree: true })
      }

      return { init: setupScrollTracking }
    },

    timeOnPage: function () {
      let sessionStartTime

      function trackTimeOnPage() {
        sessionStartTime = Date.now()
        setInterval(() => {
          const timeSpent = Math.round((Date.now() - sessionStartTime) / 1000)
          utils.sendData({
            event: 'time_on_page',
            seconds: timeSpent,
            url: window.location.href,
            timestamp: new Date().toISOString(),
            sessionId: utils.getSessionId(),
          })
        }, 60000) // Send data every minute
      }

      return { init: trackTimeOnPage }
    },

    formInteractions: function () {
      function trackFormFocus(event) {
        if (
          event.target.tagName === 'INPUT' ||
          event.target.tagName === 'TEXTAREA'
        ) {
          utils.sendData({
            event: 'form_focus',
            fieldName: event.target.name,
            fieldType: event.target.type,
            url: window.location.href,
            timestamp: new Date().toISOString(),
            sessionId: utils.getSessionId(),
          })
        }
      }

      function trackFormBlur(event) {
        if (
          event.target.tagName === 'INPUT' ||
          event.target.tagName === 'TEXTAREA'
        ) {
          utils.sendData({
            event: 'form_blur',
            fieldName: event.target.name,
            fieldType: event.target.type,
            url: window.location.href,
            timestamp: new Date().toISOString(),
            sessionId: utils.getSessionId(),
          })
        }
      }

      return {
        init: function () {
          document.addEventListener('focus', trackFormFocus, true)
          document.addEventListener('blur', trackFormBlur, true)
        },
      }
    },

    pageLoadTime: function () {
      function trackPageLoadTime() {
        window.addEventListener('load', function () {
          const pageLoadTime = performance.now()
          utils.sendData({
            event: 'page_load_time',
            loadTime: Math.round(pageLoadTime),
            url: window.location.href,
            timestamp: new Date().toISOString(),
            sessionId: utils.getSessionId(),
          })
        })
      }

      return { init: trackPageLoadTime }
    },

    userIdle: function () {
      let idleTime = 0
      let lastActiveTime

      function resetIdleTime() {
        const currentTime = Date.now()
        if (currentTime - lastActiveTime > 1000) {
          idleTime += currentTime - lastActiveTime - 1000
        }
        lastActiveTime = currentTime
      }

      function trackUserIdle() {
        lastActiveTime = Date.now()
        ;['mousemove', 'keydown', 'scroll', 'click'].forEach((eventType) => {
          document.addEventListener(eventType, resetIdleTime, true)
        })

        setInterval(() => {
          utils.sendData({
            event: 'user_idle',
            idleTime: Math.round(idleTime / 1000),
            url: window.location.href,
            timestamp: new Date().toISOString(),
            sessionId: utils.getSessionId(),
          })
        }, 60000) // Send idle time every minute
      }

      return { init: trackUserIdle }
    },

    copyEvent: function () {
      function trackCopyEvent() {
        document.addEventListener('copy', function () {
          utils.sendData({
            event: 'text_copied',
            url: window.location.href,
            timestamp: new Date().toISOString(),
            sessionId: utils.getSessionId(),
          })
        })
      }

      return { init: trackCopyEvent }
    },

    exitIntent: function () {
      function trackExitIntent() {
        document.addEventListener('mouseleave', function (event) {
          if (event.clientY <= 0) {
            utils.sendData({
              event: 'exit_intent',
              url: window.location.href,
              timestamp: new Date().toISOString(),
              sessionId: utils.getSessionId(),
            })
          }
        })
      }

      return { init: trackExitIntent }
    },

    resources: function () {
      function trackResources() {
        window.addEventListener('load', function () {
          const resources = performance.getEntriesByType('resource')
          resources.forEach((resource) => {
            utils.sendData({
              event: 'resource_timing',
              name: resource.name,
              duration: Math.round(resource.duration),
              transferSize: resource.transferSize,
              url: window.location.href,
              timestamp: new Date().toISOString(),
              sessionId: utils.getSessionId(),
            })
          })
        })
      }

      return { init: trackResources }
    },

    mouseMovement: function () {
      let mousePositions = []
      let lastMouseTrackTime

      function trackMouseMovement(event) {
        const currentTime = Date.now()
        if (currentTime - lastMouseTrackTime >= 100) {
          // Track every 100ms
          mousePositions.push({
            x: event.clientX,
            y: event.clientY,
            timestamp: currentTime,
          })
          lastMouseTrackTime = currentTime

          if (mousePositions.length >= 100) {
            // Send data every 100 positions
            utils.sendData({
              event: 'mouse_movement',
              positions: mousePositions,
              url: window.location.href,
              path: window.location.pathname,
              sessionId: utils.getSessionId(),
            })
            mousePositions = []
          }
        }
      }

      return {
        init: function () {
          lastMouseTrackTime = Date.now()
          document.addEventListener('mousemove', trackMouseMovement)
        },
      }
    },

    mouseHover: function () {
      function trackMouseHover() {
        document.addEventListener('mouseover', function (event) {
          if (
            event.target.tagName === 'A' ||
            event.target.tagName === 'BUTTON' ||
            event.target.tagName === 'INPUT' ||
            event.target.tagName === 'TEXTAREA'
          ) {
            utils.sendData({
              event: 'mouse_hover',
              element: event.target.tagName,
              elementId: event.target.id,
              elementClass: event.target.className,
              url: window.location.href,
              path: window.location.pathname,
              timestamp: new Date().toISOString(),
              sessionId: utils.getSessionId(),
            })
          }
        })
      }

      return { init: trackMouseHover }
    },

    userInput: function () {
      let inputBuffer = ''
      let lastInputTime = 0
      const inputDelay = 1000 // 1 second delay

      function sendInputData(target, inputType) {
        utils.sendData({
          event: 'user_input',
          fieldName: target.name,
          fieldType: target.type,
          inputType: inputType,
          inputLength: inputBuffer.length,
          inputPreview:
            inputBuffer.slice(0, 10) + (inputBuffer.length > 10 ? '...' : ''),
          url: window.location.href,
          path: window.location.pathname,
          timestamp: new Date().toISOString(),
          sessionId: utils.getSessionId(),
        })
        inputBuffer = ''
      }

      function handleInput(event) {
        if (
          event.target.tagName === 'INPUT' ||
          event.target.tagName === 'TEXTAREA'
        ) {
          const currentTime = Date.now()
          inputBuffer += event.data || ''

          if (currentTime - lastInputTime > inputDelay) {
            sendInputData(event.target, 'typing')
          }

          lastInputTime = currentTime
        }
      }

      function handleBlur(event) {
        if (
          (event.target.tagName === 'INPUT' ||
            event.target.tagName === 'TEXTAREA') &&
          inputBuffer.length > 0
        ) {
          sendInputData(event.target, 'blur')
        }
      }

      return {
        init: function () {
          document.addEventListener('input', handleInput)
          document.addEventListener('blur', handleBlur)
        },
      }
    },

    pageVisibility: function () {
      function trackPageVisibility() {
        document.addEventListener('visibilitychange', function () {
          utils.sendData({
            event: 'visibility_change',
            isVisible: !document.hidden,
            url: window.location.href,
            path: window.location.pathname,
            timestamp: new Date().toISOString(),
            sessionId: utils.getSessionId(),
          })
        })
      }

      return { init: trackPageVisibility }
    },

    screenOrientation: function () {
      function trackScreenOrientation() {
        window.addEventListener('orientationchange', function () {
          utils.sendData({
            event: 'orientation_change',
            orientation: window.orientation,
            url: window.location.href,
            path: window.location.pathname,
            timestamp: new Date().toISOString(),
            sessionId: utils.getSessionId(),
          })
        })
      }

      return { init: trackScreenOrientation }
    },

    networkStatus: function () {
      function updateNetworkStatus() {
        utils.sendData({
          event: 'network_status',
          online: navigator.onLine,
          url: window.location.href,
          path: window.location.pathname,
          timestamp: new Date().toISOString(),
          sessionId: utils.getSessionId(),
        })
      }

      function trackNetworkStatus() {
        window.addEventListener('online', updateNetworkStatus)
        window.addEventListener('offline', updateNetworkStatus)
      }

      return { init: trackNetworkStatus }
    },

    keyboardShortcuts: function () {
      function trackKeyboardShortcuts(event) {
        const modifiers = []
        if (event.ctrlKey) modifiers.push('Ctrl')
        if (event.altKey) modifiers.push('Alt')
        if (event.shiftKey) modifiers.push('Shift')
        if (event.metaKey) modifiers.push('Meta')

        const key = event.key
        const shortcut = [...modifiers, key].join('+')

        utils.sendData({
          event: 'keyboard_shortcut',
          shortcut: shortcut,
          url: window.location.href,
          path: window.location.pathname,
          timestamp: new Date().toISOString(),
          sessionId: utils.getSessionId(),
        })
      }

      function setupKeyboardShortcutTracking() {
        document.addEventListener('keydown', function (event) {
          if (event.ctrlKey || event.altKey || event.metaKey) {
            trackKeyboardShortcuts(event)
          }
        })
      }

      return { init: setupKeyboardShortcutTracking }
    },
  }

  // Tracker initialization
  const Tracker = {
    enabledModules: {},
    init: function (modules) {
      if (!utils.getUserConsent()) {
        console.warn('ctm.js: User has not given consent')
        utils.showConsentBanner()
        return
      }

      this.enabledModules = modules
      Object.keys(modules).forEach((module) => {
        if (trackingModules[module] && modules[module]) {
          trackingModules[module]().init()
        }
      })
    },
  }

  function initializeTracker() {
    Tracker.init({
      pageView: true,
      click: true,
      scroll: true,
      timeOnPage: true,
      formInteractions: true,
      pageLoadTime: true,
      userIdle: true,
      copyEvent: true,
      exitIntent: true,
      resources: true,
      mouseMovement: true,
      mouseHover: true,
      userInput: true,
      pageVisibility: true,
      screenOrientation: true,
      networkStatus: true,
      keyboardShortcuts: true,
    })

    console.log('ctm.js: Tracker initialized')
  }

  // Check for existing consent and initialize if present
  if (utils.getUserConsent()) {
    initializeTracker()
  } else {
    console.log('ctm.js: User has not given consent')
    utils.showConsentBanner()
  }

  // Make Tracker available globally
  window.Tracker = Tracker
})()
