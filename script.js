/**
 * Copyright (c) 2020 Alexandru Catrina <alex@codeissues.net>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
'use strict'

/**
 * Pretty format the content of a textarea if it's a JSON, otherwise signal
 * a visual error. It does nothing for empty or null content.
 *
 * @param {HTMLElement} elem The textarea or input element to alter
 * @param {string?} data The content to parse as JSON and update elem
 * @returns void
 */
function formatJson (elem, data) {
  if (!data) {
    elem.value = ''
    return
  }

  try {
    const json = JSON.parse(data)
    elem.value = JSON.stringify(json, null, 4)
    elem.classList.remove('is-danger')
  } catch (e) {
    elem.classList.add('is-danger')
  }
}

/**
 * Text field handler.
 *
 * @type {{
 *  defaults: string
 *  get: CallableFunction
 *  set: CallableFunction
 * }}
 */
const TextField = {
  defaults: '',

  /**
   * Get the value of an input, textarea or select element.
   *
   * @param {HTMLElement} elem An input, textarea or select
   * @returns {string}
   */
  get: (elem) => elem.value,

  /**
   * Set the value for an input, textarea or select element.
   *
   * @param {HTMLElement} elem An input, textarea or select
   * @param {string} data
   * @returns void
   */
  set: (elem, data) => elem.value = data
}

/**
 * Radio field exception handler.
 *
 * @type {{
 *  defaults: string
 *  get: CallableFunction
 *  set: CallableFunction
 * }}
 *
 */
const RadioFieldException = {
  defaults: '200',

  /**
   * Get the value of radio.
   *
   * @param {HTMLElement} elem
   */
  get: (elem) => elem.value,

  /**
   * Set the value for a radio.
   *
   * @param {HTMLElement} elem
   * @param {boolean} data
   */
  set: (elem, data) => {
    const all = document.querySelectorAll(`[name="${elem.name}"]`)
    for (const each of all) {
      if (each.value === data) {
        each.checked = true
        return
      }
    }

    const custom = document.querySelector(`[name="${elem.name}"][rel="custom"]`)
    custom.value = data
    custom.checked = true

    const customInput = document.getElementById('status')
    customInput.value = data
  }
}

/**
 * Boolean field handler.
 *
 * @type {{
 *  defaults: boolean
 *  get: CallableFunction
 *  set: CallableFunction
 * }}
 */
const BoolField = {
  defaults: false,

  /**
   * Get the value of checkbox.
   *
   * @param {HTMLElement} elem
   */
  get: (elem) => !!elem.checked,

  /**
   * Set the value for a checkbox.
   *
   * @param {HTMLElement} elem
   * @param {boolean} data
   */
  set: (elem, data) => elem.checked = !!data
}

/**
 * Supported fields for request, response and exceptions.
 *
 * @type {Record<string, TextField|BoolField>}
 */
const Fields = {

  // Request
  'request.route': TextField,
  'request.method': Object.assign({}, TextField, { defaults: 'get' }),
  'request.headers': Object.assign({}, TextField, { set: formatJson }),
  'request.payload': Object.assign({}, TextField, { set: formatJson }),
  '_request.headers': BoolField,
  '_request.payload': BoolField,

  // Response
  'response.status': Object.assign({}, RadioFieldException),
  'response.headers': Object.assign({}, TextField, { set: formatJson }),
  'response.data': Object.assign({}, TextField, { set: formatJson }),
  '_response.headers': BoolField,
  '_response.data': BoolField
}

/**
 * Memory is a public temporary storage to track existing fields (request,
 * response and exceptions) corelated to a tab.
 *
 * @type {Map<HTMLElement, Record<string, string>>}
 */
const Memory = new Map()

/**
 * Tabs is a public temporary storage to perserve uniqueness among user's
 * tabs.
 *
 * @type {Set<string>}
 */
const Tabs = new Set()

/**
 * View is a public state holder to render into UI the active user tab, track
 * the previous tab and the afferent request/response/exception panels.
 *
 * @type {{
 *  currentTab: HTMLElement?
 *  previousTab: HTMLElement?
 * }}
 */
const View = {
  currentTab: null,
  previousTab: null
}

/**
 * Activate tab receives an HTMLElement from the current DOM to "enable" it
 * into the state holder (View) and update the content rendered on page.
 *
 * @param {HTMLElement} tab The tab to activate
 * @returns void
 */
function activateTab (tab) {
  for (const child of tab.parentElement.children) {
    child.classList.remove('active')
  }

  tab.classList.add('active')

  View.previousTab = View.currentTab
  View.currentTab = tab

  refreshView()
}

/**
 * Create a new tab as an HTML element and set its name. Tabs must be unique.
 * Upon duplicate, an error is thrown.
 *
 * @param {string} name The name of the tab
 * @throws {Error} Tab already exists
 * @returns {{
 *  tab: HTMLElement
 *  removeBtn: HTMLElement
 * }}
 */
function createNewTabElement (name) {
  const tab = document.createElement('li')
  const removeBtn = document.createElement('a')

  tab.textContent = name
  tab.appendChild(removeBtn)
  removeBtn.classList.add('delete')

  if (Tabs.has(name)) {
    throw new Error(`A tab with the name "${name}" already exists`)
  }

  Tabs.add(name)

  return { tab, removeBtn }
}

/**
 * Add a new tab as an HTML element to the user's tabs list (navigation). If
 * menu update succeeded, the new tab is moved into View.
 *
 * @param {string} name The name of the tab to add
 * @returns {HTMLElement}
 */
function addTabToMenu (name) {
  const add = document.getElementById('createNewTab')
  const { tab, removeBtn } = createNewTabElement(name)
  add.parentElement.insertBefore(tab, add)

  removeBtn.addEventListener('click', () => {
    Tabs.delete(name)
    Memory.delete(tab)
    add.parentElement.removeChild(tab)

    if (add.parentElement.children.length > 1) {
      activateTab(add.parentElement.children.item(0))
    } else {
      addTabToMenu('Default')
    }
  })

  activateTab(tab) // NOTE: always activate new tab
  tab.addEventListener('click', (e) => {
    if (e.target === tab) {
      activateTab(tab)
    }
  })

  tab.addEventListener('dblclick', (e) => {
    if (e.target === tab) {
      const newName = prompt(`Rename tab "${tab.textContent}"`)
      if (newName) {
        if (Tabs.has(newName)) {
          alert(`Another tab with the name "${newName}" already exists`)
        } else if (newName.trim() !== tab.textContent.trim()) {
          Tabs.delete(tab.textContent)
          tab.firstChild.textContent = newName.trim()
          Tabs.add(tab.textContent)
        }
      }
    }
  })

  Memory.set(tab, {
    'request.method': Fields['request.method'].defaults,
    'response.status': Fields['response.status'].defaults
  })

  return tab
}

/**
 * Refresh the UI for the current active tab. It will render the content for
 * the afferent tab after all its fields have been pulled from memory.
 *
 * @returns void
 */
function refreshView () {
  const tabFields = Memory.get(View.currentTab) || {}
  for (const field of Object.keys(Fields)) {
    const { defaults, set } = Fields[field]

    const elem = document.querySelector(`[name="${field}"]`)
    set(elem, tabFields[field] || defaults)

    const adj = document.querySelector(`[rel="${field}"]`)
    if (adj === null) {
      continue
    }

    if (elem.checked) {
      adj.classList.remove('is-hidden')
    } else {
      adj.classList.add('is-hidden')
    }
  }
}

/**
 * Gather the content from all available tabs. Each tab created by the user is
 * the equivalent of one samplest in JSON format.
 *
 * @returns {Record<string, object>}
 */
function gatherSamplests () {
  /**
   * @type {Record<string, object>}
   */
  const files = {}
  for (const [tab, mem] of Memory.entries()) {
    const copy = { ...mem } // NOTE: don't alter original memory

    /**
     * @type {{
     *  request: Record<string, string|object>
     *  response: Record<string, string|object>
     * }}
     */
    const json = {
      request: { /* fill with request fields */ },
      response: { /* fill with response fields */ }
    }

    Object.keys(copy).forEach((input) => {
      if (input.startsWith('_')) {
        if (!copy[input]) {
          delete copy[input.substr(1)]
        }
        delete copy[input]
      }
    })
    Object.entries(copy).forEach(([input, value]) => {
      const [section, field] = input.split('.', 2)
      if (section === 'request' || section === 'response') {
        if (['headers', 'payload', 'data'].indexOf(field) > -1) {
          value = JSON.parse(value)
        }
        json[section][field] = value
      }
    })

    files[tab.textContent] = json
  }

  return files
}

/**
 * Download all user's tabs as samplests in a zip archive.
 *
 * @returns void
 */
function download () {
  const zip = new JSZip()
  const type = 'blob'
  const files = gatherSamplests()

  for (const [file, data] of Object.entries(files)) {
    const content = JSON.stringify(data, null, 4)
    zip.file(`${file}.json`, `${content}\n`) // EOF
  }

  zip.generateAsync({ type }).then((content) => {
    saveAs(content, 'samplests.zip')
  })
}

// Register event listeners
!(async function () {
  // Restore memory state (if available)
  const previousState = localStorage.getItem('samplests')
  if (previousState !== null) {
    try {
      const memory = JSON.parse(previousState)
      Object.entries(memory).forEach(([tabName, content]) => {
        const tab = addTabToMenu(tabName)
        Memory.set(tab, content)
        activateTab(tab)
      })
    } catch (e) {
      console.log(`Cannot restore last state because: ${e.message}`)
      addTabToMenu('Welcome back')
    }
  } else {
    addTabToMenu('Hello world')
  }

  // Save current memory to local storage on exit
  window.addEventListener('beforeunload', (e) => {
    /**
     * @type {Record<string, object>}
     */
    const state = {}
    for (const [tab, obj] of Memory.entries()) {
      state[tab.textContent] = obj
    }

    localStorage.setItem('samplests', JSON.stringify(state))

    // https://developer.mozilla.org/en-US/docs/Web/API/WindowEventHandlers/onbeforeunload
    e.returnValue = 'Your workspace will be saved locally'
  })

  // Render selected panel
  const panels = document.querySelectorAll('[data-panel]')
  for (const panel of panels) {
    panel.addEventListener('click', () => {
      for (const each of panels) {
        const ui = document.querySelector(`[rel="${each.dataset.panel}"]`)
        if (each.dataset.panel !== panel.dataset.panel) {
          ui.classList.add('is-hidden')
          each.classList.remove('is-active')
        } else {
          ui.classList.remove('is-hidden')
          panel.classList.add('is-active')
        }
      }
    })
  }

  // Listen for new tabs
  const createNewTab = document.getElementById('createNewTab')
  createNewTab.addEventListener('click', () => {
    const name = prompt('Create a new tab')
    if (name) {
      if (Tabs.has(name)) {
        alert(`A tab with the name "${name}" already exists`)
      } else {
        addTabToMenu(name)
      }
    }
  })

  // Listen for changes on any input, select, textarea, checkbox or radio
  const inputs = document.querySelectorAll('[name]')
  for (const input of inputs) {
    input.addEventListener('change', () => {
      const fields = Memory.get(View.currentTab) || {}
      fields[input.name] = Fields[input.name].get(input)
      Memory.set(View.currentTab, fields)
    })
  }

  // Format textarea as JSON
  const textareas = document.querySelectorAll('textarea')
  for (const textarea of textareas) {
    textarea.addEventListener('change', () => {
      formatJson(textarea, textarea.value)
    })
  }

  // Display adjacent fields if checkboxes are ticked
  const checkboxes = document.querySelectorAll('[type="checkbox"]')
  for (const checkbox of checkboxes) {
    checkbox.addEventListener('click', () => {
      const box = document.querySelector(`[rel="${checkbox.name}"]`)
      if (checkbox.checked) {
        box.classList.remove('is-hidden')
      } else {
        box.classList.add('is-hidden')
      }
    })
  }

  // Change selected radio input if the custom field is edited
  const statuscode = document.querySelector('[type="number"][name="response.status"]')
  statuscode.addEventListener('change', () => {
    const custom = document.querySelector('[type="radio"][rel="custom"]')
    custom.checked = true
    custom.value = statuscode.value
  })
})()
