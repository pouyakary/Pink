
//
// Copyright (c) 2021 - present by Pouya Kary <kary@gnu.org>
// This was written to learn P5 so I could show it to Zea <3
//


// ─── Constants ─────────────────────────────────────────────────────────── ✣ ─

// MARK: Constants

const FACTORY_STROKE_SIZE = 9
const LINE_AVERAGING_SENSITIVITY = 7
const MOUSE_ERASE_SENSITIVITY = LINE_AVERAGING_SENSITIVITY * 1.5
const MOUSE_HOVER_SENSITIVITY = 120
const STORAGE_KEY = "org.pouyakary.pink.model"
const LOCK_KEY = "org.pouyakary.pink.lock"
const SELECTION_PADDING = 20
const SELECTION_BOX_CORNER_SIZE = 15
const SELECTION_BOX_STROKE_WEIGHT = 4
const DARK_PINK_DELTA = 130
const LIGHT_PINK_BASE = 145
const BOUNDARY_SENSITIVITY = 8.1;
const CURVE_SMOOTHING_STEPS = 4

const ERASE_BASE_COLOR_LIGHT = [171, 188, 219]
const ERASE_BASE_COLOR_DARK = [197, 57, 115]
const ERASE_SELECTED_COLOR_LIGHT = [230, 0, 0]
const ERASE_SELECTED_COLOR_DARK = [200, 0, 0]
const HIGHLIGHT_COLOR_LIGHT = [90, 37, 161]
const HIGHLIGHT_COLOR_DARK = [90, 37, 161]
const DRAW_COLOR_LIGHT = [199, 21, 133]
const DRAW_COLOR_DARK = [199, 21, 133]

// ─── Globals ───────────────────────────────────────────────────────────── ✣ ─

// MARK: Globals

var model = null
var shouldActOnMouseHover = false
var eraseMode = false
var canvas = null
var selectedShapeIndex = -1
var somethingIsSelected = false
var frameThatEnteredErase = 0
var htmlSectionIsActive = false
var dialogIsOpen = false
var helpPageIsOpen = false
var locked = false
var status = undefined
var lockButton = undefined
var undoButton = undefined
var resetButton = undefined
var centerButton = undefined
var darkMode = false
var pinkBase = 0
var colorLayer = null
var maskLayer = null
var glitterLayer = null
var glitterShader = null
var maskNeedsFullRedraw = true
var overlayLayer = null

// ─── Shape ─────────────────────────────────────────────────────────────── ✣ ─

// MARK: Shape

class Shape {
    constructor(initial) {
        this.points = initial ? initial : []
    }

    // MARK: ... Append

    append(x, y) {
        this.points.push([x, y])
    }

    // MARK: ... Read

    read(index) {
        this.points[index]
    }

    // MARK: ... Size

    get size() {
        return this.points.length
    }

    // MARK: ... Compute Boundary

    computeBoundary() {
        let minX = Infinity
        let maxX = -Infinity
        let minY = Infinity
        let maxY = -Infinity

        for (const [x, y] of this.points) {
            if (x > maxX) {
                maxX = x
            }
            if (x < minX) [
                minX = x
            ]
            if (y > maxY) {
                maxY = y
            }
            if (y < minY) {
                minY = y
            }
        }

        const strokeSizeBoundary = FACTORY_STROKE_SIZE - 1
        const halfOfStrokeBoundary = Math.floor(strokeSizeBoundary / 2)
        const width = maxX - minX + strokeSizeBoundary
        const height = maxY - minY + strokeSizeBoundary

        return {
            x: minX - halfOfStrokeBoundary,
            y: minY - halfOfStrokeBoundary,
            width, height
        }
    }

    // MARK: ... Is Cursor?

    get isShapeUnderCursor() {
        for (const [x, y] of this.points) {
            if (length(x, y, mouseX, mouseY) < MOUSE_ERASE_SENSITIVITY) {
                return true
            }
        }
        return false
    }

    // MARK: ... Draw

    draw(shouldAllShapeBeSelected, target = null) {
        const context = target || window
        let px = 0
        let py = 0
        let isNotFirst = false

        for (const [x, y] of this.points) {
            if (isNotFirst) {
                decideColor(x, y, shouldAllShapeBeSelected, context)
                context.line(px, py, x, y)
            }
            px = x
            py = y
            isNotFirst = true
        }
    }

    // MARK: ... Draw Selection

    drawSelection() {
        const { x, y, width, height } = this.computeBoundary()
        if (darkMode) {
            drawSelectionBox(x, y, width, height)
        }
    }

    // MARK: ... Remove Last Point

    removeLastPoint() {
        this.points.pop()
    }

    // MARK: ... Smooth Curve

    smoothCurve() {
        if (!this.points || this.points.length < 3 || CURVE_SMOOTHING_STEPS <= 0) {
            return
        }

        const smoothed = [clonePoint(this.points[0])]
        const lastIndex = this.points.length - 1
        const subdivisions = CURVE_SMOOTHING_STEPS

        for (let index = 0; index < lastIndex; index++) {
            const p0 = this.points[index === 0 ? 0 : index - 1]
            const p1 = this.points[index]
            const p2 = this.points[index + 1]
            const p3 = this.points[index + 2 <= lastIndex ? index + 2 : lastIndex]

            for (let step = 1; step <= subdivisions; step++) {
                const t = step / (subdivisions + 1)
                smoothed.push(catmullRomPoint(p0, p1, p2, p3, t))
            }

            smoothed.push(clonePoint(p2))
        }

        this.points = smoothed
    }

    // MARK: ... Finalize

    finalize() {
        this.smoothCurve()
    }
}

// ─── Model ─────────────────────────────────────────────────────────────── ✣ ─

// MARK: Model

class Model {
    constructor() {
        this.shapes = []

        this.loadPreviousState()
    }

    get size() {
        return this.shapes.length
    }

    finalizeLastShape() {
        if (this.shapes.length > 0) {
            const shape = this.shapes[this.shapes.length - 1]
            shape.finalize()
            scheduleMaskRebuild()
        }
    }

    appendNewEmptyShape() {
        this.shapes.push(new Shape())
    }

    addToBuffer(x, y) {
        const shape = this.shapes[this.shapes.length - 1]
        shape.append(x, y)
        drawLatestSegmentOnMask(shape)
    }

    loadPreviousState() {
        const state = JSON.parse(getItem(STORAGE_KEY))
        if (state !== null && state !== undefined && state !== "" && state instanceof Array) {
            this.loadFromJSON(state)
        } else {
            this.loadFromJSON(ZEAS_SNAIL)
            setTimeout(() => this.center())
        }
    }

    loadFromJSON(state) {
        const shapes = []
        for (const shapeRAW of state) {
            if (!shapeRAW instanceof Array) {
                return
            }
            for (const point of shapeRAW) {
                if (!point instanceof Array) {
                    return
                }
                for (const position of point) {
                    if (typeof position !== "number") {
                        return
                    }
                }
            }
            if (shapeRAW.length !== 0) {
                shapes.push(new Shape(shapeRAW))
            }
            this.shapes = shapes
        }
        scheduleMaskRebuild()
    }

    storeCurrentState() {
        storeItem(STORAGE_KEY, this.json)
    }

    removeLastShape() {
        this.shapes.pop()
        if (this.shapes.length === 0) {
            this.shapes.push(new Shape())
        }
        scheduleMaskRebuild()
    }

    removeShapeAtIndex(index) {
        const size = this.shapes.length
        if (index >= 0 && index < size) {
            const newShapes = []
            for (let i = 0; i < size; i++) {
                if (i !== index) {
                    newShapes.push(this.shapes[i])
                }
            }
            this.shapes = newShapes
            scheduleMaskRebuild()
        }
    }

    removeSelectedShape() {
        this.removeShapeAtIndex(selectedShapeIndex)
    }

    undo() {
        const last = this.shapes[this.shapes.length - 1]
        if (last.size > 0) {
            last.removeLastPoint()
        } else {
            this.removeLastShape()
        }
        scheduleMaskRebuild()
    }

    reset() {
        this.shapes = []
        this.storeCurrentState
        resetURL()
        scheduleMaskRebuild()
    }

    get json() {
        return JSON.stringify(this.shapes.map(shape => shape.points))
    }

    garbageCollect() {
        if (shouldActOnMouseHover) {
            return
        }

        const bs2 = Math.pow(BOUNDARY_SENSITIVITY, 2)

        for (let index = 0; index < this.shapes.length; index++) {
            const shape = this.shapes[index]
            const boundary = shape.computeBoundary()
            console.log({ boundary })
            if (shape.size < 2 || boundary.width * boundary.height < bs2) {
                this.removeShapeAtIndex(index)
            }
        }
        scheduleMaskRebuild()
    }

    computeByteArraySize() {
        let size = 0
        for (const shape of this.shapes) {
            size += shape.size * 2 + 1
        }
        return size
    }

    get boundary() {
        let minX = Infinity
        let maxX = -Infinity
        let minY = Infinity
        let maxY = -Infinity

        for (const shape of this.shapes) {
            for (const [x, y] of shape.points) {
                if (x > maxX) {
                    maxX = x
                }
                if (x < minX) [
                    minX = x
                ]
                if (y > maxY) {
                    maxY = y
                }
                if (y < minY) {
                    minY = y
                }
            }
        }

        const strokeSizeBoundary = FACTORY_STROKE_SIZE - 1
        const halfOfStrokeBoundary = Math.floor(strokeSizeBoundary / 2)
        const width = maxX - minX + strokeSizeBoundary
        const height = maxY - minY + strokeSizeBoundary

        return {
            x: minX - halfOfStrokeBoundary,
            y: minY - halfOfStrokeBoundary,
            width, height
        }
    }

    center() {
        this.garbageCollect()
        const boundary = this.boundary
        const newBaseX = (width - boundary.width) / 2
        const newBaseY = (height - boundary.height) / 2
        const dx = newBaseX - boundary.x
        const dy = newBaseY - boundary.y
        for (const shape of this.shapes) {
            for (const point of shape.points) {
                point[0] += dx
                point[1] += dy
            }
        }
        scheduleMaskRebuild()
    }
}

//
// ─── PROCESSING MAIN ────────────────────────────────────────────────────────────
//

function preload() {
    glitterShader = loadShader('shaders/glitter.vert', 'shaders/glitter.frag')
}

function setup() {
    model = new Model()
    locked = loadLockFromState()

    statusView = document.getElementById("status")
    lockButton = document.getElementById("lock-button")
    undoButton = document.getElementById("undo-button")
    resetButton = document.getElementById("reset-button")
    centerButton = document.getElementById("center-button")
    applyLockChangeEffects()
    createCanvas(window.innerWidth, window.innerHeight);
    canvas = document.querySelector("canvas")

    initializeGraphicsLayers()
    rebuildMaskFromModel()

    registerEvents()

    window.requestAnimationFrame(() => {
        document.body.classList.remove('loading')
    })
}

function registerEvents() {
    const disable = event => event.preventDefault()
    document.addEventListener("contextmenu", disable)
    document.addEventListener("click", disable)

    for (const element of document.querySelectorAll("bar-button")) {
        for (const ev of ["touchstart", "mousedown"]) {
            element.addEventListener(ev, () => htmlSectionIsActive = true)
        }
        for (const ev of ["touchend", "touchleave", "mouseup", "mouseout"]) {
            element.addEventListener(ev, () => htmlSectionIsActive = false)
        }
    }
}

function initializeGraphicsLayers() {
    createColorLayer()
    createMaskLayer()
    createGlitterLayer()
    createOverlayLayer()
    scheduleMaskRebuild()
}

function configureColorLayer(layer = colorLayer) {
    if (!layer) {
        return
    }
    layer.colorMode(RGB, 255)
    layer.strokeWeight(FACTORY_STROKE_SIZE)
    layer.strokeCap(ROUND)
    layer.strokeJoin(ROUND)
    layer.noFill()
}

function configureMaskLayer(layer = maskLayer) {
    if (!layer) {
        return
    }
    layer.stroke(255)
    layer.strokeWeight(FACTORY_STROKE_SIZE)
    layer.strokeCap(ROUND)
    layer.strokeJoin(ROUND)
    layer.noFill()
}

function configureOverlayLayer(layer = overlayLayer) {
    if (!layer) {
        return
    }
    layer.noFill()
}

function configureGlitterLayer(layer = glitterLayer) {
    if (!layer) {
        return
    }
    layer.noStroke()
    layer.rectMode(CENTER)
    layer.textureMode(NORMAL)
}

function ensureGraphicsLayer(existingLayer, renderer, configure) {
    const targetWidth = windowWidth
    const targetHeight = windowHeight

    let layer = existingLayer

    if (layer) {
        layer.resizeCanvas(targetWidth, targetHeight)
    } else {
        layer = createGraphics(targetWidth, targetHeight, renderer)
    }

    layer.pixelDensity(pixelDensity())
    layer.clear()

    if (configure) {
        configure(layer)
    }

    return layer
}

function createColorLayer() {
    colorLayer = ensureGraphicsLayer(colorLayer, undefined, configureColorLayer)
}

function createMaskLayer() {
    maskLayer = ensureGraphicsLayer(maskLayer, undefined, configureMaskLayer)
}

function createOverlayLayer() {
    overlayLayer = ensureGraphicsLayer(overlayLayer, undefined, configureOverlayLayer)
}

function createGlitterLayer() {
    glitterLayer = ensureGraphicsLayer(glitterLayer, WEBGL, configureGlitterLayer)
}

function recreateGraphicsLayers() {
    createColorLayer()
    createMaskLayer()
    createGlitterLayer()
    createOverlayLayer()
    scheduleMaskRebuild()
    rebuildMaskFromModel()
}

function scheduleMaskRebuild() {
    maskNeedsFullRedraw = true
}

function rebuildMaskFromModel() {
    if (!maskLayer || !model) {
        return
    }

    maskLayer.clear()
    configureMaskLayer()

    for (const shape of model.shapes) {
        drawShapeOnMask(shape)
    }

    maskNeedsFullRedraw = false
}

function drawShapeOnMask(shape) {
    if (!maskLayer || !shape || shape.size === 0) {
        return
    }

    const { points } = shape
    if (points.length === 1) {
        const [x, y] = points[0]
        maskLayer.point(x, y)
        return
    }

    let [px, py] = points[0]
    for (let index = 1; index < points.length; index++) {
        const [x, y] = points[index]
        maskLayer.line(px, py, x, y)
        px = x
        py = y
    }
}

function drawLatestSegmentOnMask(shape) {
    if (!maskLayer || !shape || shape.size === 0) {
        return
    }

    configureMaskLayer()

    if (shape.size === 1) {
        const [x, y] = shape.points[0]
        maskLayer.point(x, y)
        return
    }

    const lastIndex = shape.points.length - 1
    const [x1, y1] = shape.points[lastIndex - 1]
    const [x2, y2] = shape.points[lastIndex]
    maskLayer.line(x1, y1, x2, y2)
}

function renderColorLayer() {
    if (!colorLayer) {
        return
    }

    colorLayer.clear()
    configureColorLayer()

    let shapeIndex = 0
    for (const shape of model.shapes) {
        const shouldSelectShape = shapeIndex === selectedShapeIndex
        shape.draw(shouldSelectShape, colorLayer)
        shapeIndex++
    }
}

function renderGlitterLayer() {
    if (!glitterLayer || !glitterShader || !maskLayer || !colorLayer) {
        return
    }

    glitterLayer.clear()
    glitterLayer.shader(glitterShader)
    glitterShader.setUniform('uMask', maskLayer)
    glitterShader.setUniform('uColorLayer', colorLayer)
    glitterShader.setUniform('uResolution', [width, height])
    glitterShader.setUniform('uTime', millis() / 1000)
    glitterShader.setUniform('uDarkMode', darkMode ? 1.0 : 0.0)
    glitterLayer.rect(0, 0, width, height)
    glitterLayer.resetShader()
}


function draw() {
    darkMode = isTheSystemOnDarkMode()
    somethingIsSelected = false
    selectedShapeIndex = -1

    renderHelpPageBasedOnState()
    applyMode()
    setAppearanceColors()
    strokeWeight(FACTORY_STROKE_SIZE)

    let shapeIndex = 0
    for (const shape of model.shapes) {
        const shouldSelectShape = eraseMode && shape.isShapeUnderCursor
        if (shouldSelectShape) {
            somethingIsSelected = true
            selectedShapeIndex = shapeIndex
        }
        shapeIndex++
    }

    if (maskNeedsFullRedraw) {
        rebuildMaskFromModel()
    }

    renderColorLayer()

    const canRenderGlitter = glitterLayer && glitterShader && maskLayer && colorLayer
    if (canRenderGlitter) {
        renderGlitterLayer()
        image(glitterLayer, 0, 0, width, height)
    } else if (colorLayer) {
        image(colorLayer, 0, 0, width, height)
    }

    renderOverlay()

    setCursor()

    if (!shouldNotHandleTheMouse()) {
        if (shouldActOnMouseHover) {
            if (eraseMode) {
                if (somethingIsSelected && selectedShapeIndex >= 0) {
                    model.removeSelectedShape()
                }
            } else {
                model.addToBuffer(mouseX, mouseY)
            }
        }

        if (keyIsDown(LEFT_ARROW)) {
            model.undo()
        }
    }

    if (!focused) {
        shouldActOnMouseHover = false
    }

    model.storeCurrentState()
}

//
// ─── EVENTS ─────────────────────────────────────────────────────────────────────
//

function shouldNotHandleTheMouse() {
    return htmlSectionIsActive || !focused || helpPageIsOpen || locked || dialogIsOpen
}

function mousePressed() {
    if (shouldNotHandleTheMouse()) {
        return
    }

    if (mouseButton === RIGHT) {
        toggleEraseDrawMode()
    } else {
        if (!eraseMode) {
            model.appendNewEmptyShape()
        }
        shouldActOnMouseHover = true
    }
}

function mouseReleased() {
    if (shouldNotHandleTheMouse()) {
        return
    }

    if (!eraseMode) {
        model.finalizeLastShape()
    }

    shouldActOnMouseHover = false
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight)
    recreateGraphicsLayers()
}


function toggleEraseDrawMode() {
    if (locked) return;
    eraseMode = !eraseMode
}

function applyLockChangeEffects() {
    lockButton.innerHTML = (locked
        ? `<span class="material-icons-outlined">lock</span>`
        : `<span class="material-icons-outlined">lock_open</span>`
    )
    setElementHidden(undoButton, locked)
    setElementHidden(resetButton, locked)
    setElementHidden(centerButton, locked)
}

function setElementHidden(element, shouldBeHidden) {
    element.style.display = shouldBeHidden ? "none" : "block"
}

//
// ─── DRAW HELPERS ───────────────────────────────────────────────────────────────
//

function setCursorClassToElement(element, cursor) {
    for (const cursorClass of ["drawing-cursor", "erasing-cursor", "pointing-cursor"]) {
        element.classList.remove(cursorClass)
    }
    element.classList.add(cursor)
}


function setCursor() {
    if (locked || dialogIsOpen) {
        setCursorClassToElement(document.body, "pointing-cursor")
    } else {
        if (eraseMode) {
            setCursorClassToElement(document.body, "erasing-cursor")
        } else {
            setCursorClassToElement(document.body, "drawing-cursor")
        }
    }
}

function applyStroke(painter, color) {
    if (!color) {
        return
    }
    painter.stroke(color[0], color[1], color[2])
}

function decideColor(x, y, shouldAllShapeBeSelected, target = null) {
    const painter = target || window
    const drawBaseColor = darkMode ? DRAW_COLOR_DARK : DRAW_COLOR_LIGHT
    const highlightColor = darkMode ? HIGHLIGHT_COLOR_DARK : HIGHLIGHT_COLOR_LIGHT
    const eraseNeutralColor = darkMode ? ERASE_BASE_COLOR_DARK : ERASE_BASE_COLOR_LIGHT
    const eraseSelectedColor = darkMode ? ERASE_SELECTED_COLOR_DARK : ERASE_SELECTED_COLOR_LIGHT

    if (eraseMode) {
        if (shouldAllShapeBeSelected) {
            applyStroke(painter, eraseSelectedColor)
            return
        }

        if (somethingIsSelected && shouldActOnMouseHover) {
            applyStroke(painter, highlightColor)
            return
        }

        applyStroke(painter, eraseNeutralColor)
        return
    }

    const radius = length(x, y, mouseX, mouseY)
    if (radius < MOUSE_HOVER_SENSITIVITY) {
        applyStroke(painter, highlightColor)
    } else {
        applyStroke(painter, drawBaseColor)
    }
}

function applyMode() {
    if (locked) {
        statusView.classList.remove("red")
        statusView.innerHTML = "VIEW ONLY"
    } else {
        if (shouldActOnMouseHover) {
            statusView.innerHTML = eraseMode ? "ERASING" : "DRAWING"
        } else {
            statusView.innerHTML = eraseMode ? "ERASE MODE" : "DRAW MODE"
        }

        if (eraseMode) {
            statusView.classList.add("red")
        } else {
            statusView.classList.remove("red")
        }
    }
}

function setAppearanceColors() {
    pinkBase = darkMode ? 0 : LIGHT_PINK_BASE

    if (eraseMode) {
        background(210, 222, 245)
    } else if (darkMode) {
        background(0)
    } else {
        background(255, 190, 215)
    }
}

//
// ─── UNDO ───────────────────────────────────────────────────────────────────────
//

function undo() {
    model.undo()
}

function undoLastShape() {
    model.removeLastShape()
}

function reset() {
    askForConfirmation({
        emoji: "🧨",
        message: "Are you sure about cleaning all the screen?",
        yes: "Erase Everything",
        no: "Stop",
    }).then(confirmed => {
        if (confirmed) {
            model.reset()
        }
    })
}

//
// ─── HELPERS ────────────────────────────────────────────────────────────────────
//

function resetURL() {
    window.location.href = window.location.pathname
}

function length(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow((x1 - x2), 2) + Math.pow((y1 - y2), 2))
}

function clonePoint(point) {
    return [point[0], point[1]]
}

function catmullRomPoint(p0, p1, p2, p3, t) {
    const t2 = t * t
    const t3 = t2 * t

    const x = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)
    const y = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)

    return [x, y]
}

function isTouchDevice() {
    return (
        ('ontouchstart' in window) ||
        (navigator.maxTouchPoints > 0) ||
        (navigator.msMaxTouchPoints > 0)
    )
}

function handleClick(func) {
    setTimeout(func)
}

function renderHelpPageBasedOnState() {
    document.getElementById("help-screen").style.display =
        helpPageIsOpen ? "flex" : "none"
}

function isTheSystemOnDarkMode() {
    const query = window.matchMedia("(prefers-color-scheme: dark)")
    if (query) {
        return query.matches
    }
    return false
}

function loadLockFromState() {
    try {
        const lockState = getItem(LOCK_KEY)
        if (lockState) {
            const jsonLockState = JSON.parse(lockState)
            if (typeof jsonLockState === "boolean") {
                return jsonLockState
            }
        }
        return false
    } catch (error) {
        return false
    }
}

function toggleLock() {
    function changeLock() {
        return new Promise((returnNewLockStatus) => {
            if (locked) {
                askForConfirmation({
                    emoji: "🧨",
                    message: "Are you sure about unlocking?",
                    yes: "Unlock",
                    no: "Stay Locked",
                }).then(confirmed => {
                    returnNewLockStatus(!confirmed)
                })
            } else {
                returnNewLockStatus(true)
            }
        })
    }

    changeLock().then(newLockStatus => {
        locked = newLockStatus
        if (locked) {
            eraseMode = false
        }
        storeItem(LOCK_KEY, JSON.stringify(locked))
        applyLockChangeEffects()
    })

}

function makeCenter() {
    model.center()
}

//
// ─── DRAWING HELPERS ────────────────────────────────────────────────────────────
//

function drawSelectionBox(x, y, width, height) {
    if (!overlayLayer) {
        return
    }

    overlayLayer.strokeWeight(SELECTION_BOX_STROKE_WEIGHT)
    overlayLayer.stroke(200 + (darkMode ? 0 : 30), 0, 0)
    overlayLayer.noFill()

    const topLeftX = x - SELECTION_PADDING
    const topLeftY = y - SELECTION_PADDING

    overlayLayer.line(topLeftX, topLeftY, topLeftX + SELECTION_BOX_CORNER_SIZE, topLeftY)
    overlayLayer.line(topLeftX, topLeftY, topLeftX, topLeftY + SELECTION_BOX_CORNER_SIZE)

    const topRightX = topLeftX + 2 * SELECTION_PADDING + width
    const topRightY = topLeftY
    overlayLayer.line(topRightX - SELECTION_BOX_CORNER_SIZE, topRightY, topRightX, topRightY)
    overlayLayer.line(topRightX, topRightY, topRightX, topRightY + SELECTION_BOX_CORNER_SIZE)

    const bottomLeftX = topLeftX
    const bottomLeftY = topLeftY + 2 * SELECTION_PADDING + height
    overlayLayer.line(bottomLeftX, bottomLeftY, bottomLeftX + SELECTION_BOX_CORNER_SIZE, bottomLeftY)
    overlayLayer.line(bottomLeftX, bottomLeftY - SELECTION_BOX_CORNER_SIZE, bottomLeftX, bottomLeftY)

    const bottomRightX = topRightX
    const bottomRightY = bottomLeftY
    overlayLayer.line(bottomRightX, bottomRightY, bottomRightX - SELECTION_BOX_CORNER_SIZE, bottomRightY)
    overlayLayer.line(bottomRightX, bottomRightY - SELECTION_BOX_CORNER_SIZE, bottomRightX, bottomRightY)
}

function renderOverlay() {
    if (!overlayLayer) {
        return
    }

    overlayLayer.clear()

    if (somethingIsSelected && (eraseMode || !shouldActOnMouseHover) && selectedShapeIndex >= 0) {
        const shape = model.shapes[selectedShapeIndex]
        if (shape) {
            const { x, y, width, height } = shape.computeBoundary()
            drawSelectionBox(x, y, width, height)
        }
    }

    image(overlayLayer, 0, 0, width, height)
}

//
// ─── DIALOG ─────────────────────────────────────────────────────────────────────
//

function askForConfirmation({ message, yes, no, emoji }) {
    return new Promise(returnConfirmation => {
        const container = document.getElementById("dialog-container")
        const dialogEmoji = document.getElementById("dialog-emoji")
        const messageBox = document.getElementById("dialog-message")
        const okayButton = document.getElementById("dialog-okay-button")
        const cancelButton = document.getElementById("dialog-cancel-button")

        dialogEmoji.innerText = emoji
        messageBox.innerText = message
        okayButton.innerText = yes
        cancelButton.innerText = no

        function onOkay() {
            closeDialog()
            returnConfirmation(true)
        }

        function onCancel() {
            closeDialog()
            returnConfirmation(false)
        }

        function closeDialog() {
            okayButton.removeEventListener("click", onOkay)
            cancelButton.removeEventListener("click", onCancel)
            container.classList.add("hidden")
            dialogIsOpen = false
        }

        okayButton.addEventListener("click", onOkay)
        cancelButton.addEventListener("click", onCancel)
        dialogIsOpen = true
        container.classList.remove("hidden")
    })
}

// ────────────────────────────────────────────────────────────────────────────────
