
//
// Copyright (c) 2021 - present by Pouya Kary <mail@pouya.us>
// This was written to learn P5 so I could show it to Zea <3
//


//
// ─── CONSTANTS ──────────────────────────────────────────────────────────────────
//

    const FACTORY_STROKE_SIZE = 9
    const LINE_AVERAGING_SENSITIVITY = 7
    const MOUSE_ERASE_SENSITIVITY = LINE_AVERAGING_SENSITIVITY * 1.5
    const MOUSE_HOVER_SENSITIVITY = 70
    const STORAGE_KEY = "us.kary.pink.model"
    const LOCK_KEY = "us.kary.pink.lock"
    const SELECTION_PADDING = 20
    const SELECTION_BOX_CORNER_SIZE = 15
    const SELECTION_BOX_STROKE_WEIGHT = 4
    const DARK_PINK_DELTA = 130
    const LIGHT_PINK_BASE = 145
    const BOUNDARY_SENSITIVITY = 8;

//
// ─── GLOBALS ────────────────────────────────────────────────────────────────────
//

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

//
// ─── SHAPE ──────────────────────────────────────────────────────────────────────
//

    class Shape {
        constructor(initial) {
            this.points = initial ? initial : []
        }

        append(x, y) {
            this.points.push([x, y])
            this.finalize()
        }

        read(index) {
            this.points[index]
        }

        get size() {
            return this.points.length
        }

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

        get isShapeUnderCursor() {
            for (const [x, y] of this.points) {
                if (length(x, y, mouseX, mouseY) < MOUSE_ERASE_SENSITIVITY) {
                    return true
                }
            }
            return false
        }

        draw(shouldAllShapeBeSelected) {
            let px = 0
            let py = 0
            let isNotFirst = false

            for (const [x, y] of this.points) {
                if (isNotFirst) {
                    decideColor(x, y, shouldAllShapeBeSelected)
                    line(px, py, x, y)
                }
                px = x
                py = y
                isNotFirst = true
            }
        }

        drawSelection() {
            const {x, y, width, height} = this.computeBoundary()
            if (darkMode) {
                drawSelectionBox(x, y, width, height)
            }
        }

        removeLastPoint() {
            this.points.pop()
        }

        makeLinesEven() {
            if (!this.points || this.points.length === 0) {
                return
            }

            const newPoints = []
            let px = 0
            let py = 0
            let isFirst = true
            for (const [x, y] of this.points) {
                if (isFirst) {
                    px = x
                    py = y
                    isFirst = false
                    newPoints.push([x, y])
                } else {
                    if (length(x, y, px, py) > LINE_AVERAGING_SENSITIVITY) {
                        newPoints.push([x, y])
                        px = x
                        py = y
                    }
                }
            }
            const last = this.points.pop()
            if (last) {
                newPoints.push(last)
            }
            this.points = newPoints
        }

        finalize() {
            this.makeLinesEven()
        }
    }

//
// ─── MODEL ──────────────────────────────────────────────────────────────────────
//

    class Model {
        constructor() {
            this.shapes = []

            this.loadPreviousState()

            if (window.location.search !== "") {
                this.loadFromModelArray(this.shapes)
            }

            setInterval(() => this.garbageCollect(), 1000)
        }

        get size() {
            return this.shapes.length
        }

        finalizeLastShape() {
            if (this.shapes.length > 0) {
                this.shapes[this.shapes.length - 1].finalize()
            }
        }

        appendNewEmptyShape() {
            this.shapes.push(new Shape())
        }

        addToBuffer(x, y) {
            this.shapes[this.shapes.length - 1].append(x, y)
        }

        loadFromModelArray(shapes) {
            function shouldOpen() {
                return new Promise((resolve) => {
                    if (shapes.length === 0) {
                        resolve(true)
                    } else {
                        askForConfirmation({
                            emoji:      "🧨",
                            message:    "Loading the model from this URL will replace your local sketch. Do you want to proceed?",
                            yes:        "Replace Local With Shared Sketch",
                            no:         "Keep Local",
                        }).then(resolve)
                    }
                })
            }
            return new Promise((resolve) => {
                try {
                    shouldOpen().then(confirmed => {
                        if (confirmed) {
                            const state = JSON.parse(atob(window.location.search.replace("?", "")))
                            this.loadFromJSON(state)
                        }
                        resolve(confirmed)
                    })
                } catch (error) {
                    resolve(false)
                }
            })
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
        }

        storeCurrentState() {
            storeItem(STORAGE_KEY, this.json)
        }

        get urlComponent() {
            return btoa(this.json)
        }

        removeLastShape() {
            this.shapes.pop()
            if (this.shapes.length === 0) {
                this.shapes.push(new Shape())
            }
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
        }

        reset() {
            this.shapes = []
            this.storeCurrentState
            resetURL()
        }

        get json( ) {
            return JSON.stringify(this.shapes.map(shape => shape.points))
        }

        garbageCollect() {
            if (shouldActOnMouseHover) {
                return
            }

            for (let index = 0; index < this.shapes.length; index++) {
                const shape = this.shapes[index]
                const boundary = shape.computeBoundary()
                if (shape.size < 2 || boundary.width < BOUNDARY_SENSITIVITY || boundary.height < BOUNDARY_SENSITIVITY) {
                    this.removeShapeAtIndex(index)
                }
            }
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
        }
    }

//
// ─── PROCESSING MAIN ────────────────────────────────────────────────────────────
//

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

        registerEvents()
    }

    function registerEvents() {
        const disable = event => event.preventDefault()
        document.addEventListener("contextmenu", disable)
        document.addEventListener("click", disable)

        for (const element of document.querySelectorAll("bar-button")) {
            element.addEventListener("mouseover", ( ) => htmlSectionIsActive = true)
            element.addEventListener("mouseout", ( ) => htmlSectionIsActive = false)
        }
    }


    function draw() {
        darkMode = isTheSystemOnDarkMode()
        somethingIsSelected = false
        let shapeIndex = 0

        renderHelpPageBasedOnState()
        applyMode()
        setAppearanceColors()
        strokeWeight(FACTORY_STROKE_SIZE)

        for (const shape of model.shapes) {
            const shouldAllShapeBeSelected = eraseMode && shape.isShapeUnderCursor
            if (shouldAllShapeBeSelected) {
                somethingIsSelected = true
                selectedShapeIndex = shapeIndex
            }
            shapeIndex++
        }

        shapeIndex = 0
        for (const shape of model.shapes) {
            shape.draw(shapeIndex === selectedShapeIndex)
            shapeIndex++
        }

        setCursor()

        if (!somethingIsSelected) {
            selectedShapeIndex = -1
        } else {
            if (!shouldActOnMouseHover) {
                model.shapes[selectedShapeIndex].drawSelection()
            }
        }


        if (!shouldNotHandleTheMouse()) {
            if (shouldActOnMouseHover) {
                if (eraseMode) {
                    if (somethingIsSelected) {
                        model.removeSelectedShape( )
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

        shouldActOnMouseHover = false
    }

    function windowResized() {
        resizeCanvas(windowWidth, windowHeight)
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

    function setCursorClassToElement (element, cursor) {
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

    function decideColor (x, y, shouldAllShapeBeSelected) {
        if (eraseMode) {
            if (somethingIsSelected) {
                if (shouldActOnMouseHover) {
                    stroke(pinkBase + random(255 - pinkBase), 0, pinkBase + random(255 - pinkBase)) // pink
                } else {
                    if (shouldAllShapeBeSelected) {
                        stroke(random(155) + 100 + pinkBase * 0.4, 0, 0) // red
                    } else {
                        if (darkMode) {
                            stroke(random(255 - DARK_PINK_DELTA), 0, random(255 - DARK_PINK_DELTA)) // dark pink
                        } else {
                            stroke(171, 188, 219) // a solid magenta that matches the light background
                        }
                    }
                }
            } else {
                stroke(pinkBase + random(255 - pinkBase), 0, pinkBase + random(255 - pinkBase)) // pink
            }
        } else {
            const radius = length(x, y, mouseX, mouseY)
            if (radius < MOUSE_HOVER_SENSITIVITY) {
                if (darkMode) {
                    stroke(0, random(255), random(100)) // green
                } else {
                    const base = random(150)
                    stroke(base, base, base + 155 + random(150 - base)) // blue
                }
            } else {
                stroke(pinkBase + random(255 - pinkBase), 0, pinkBase + random(255 - pinkBase)) // pink
            }
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

            if ( eraseMode ) {
                statusView.classList.add("red")
            } else {
                statusView.classList.remove("red")
            }
        }
    }

    function setAppearanceColors() {
        if (darkMode) {
            background(0)
            pinkBase = 0
        } else {
            background(235, 242, 255)
            pinkBase = LIGHT_PINK_BASE
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
            emoji:      "🧨",
            message:    "Are you sure about cleaning all the screen?",
            yes:        "Erase Everything",
            no:         "Stop",
        }).then(confirmed => {
            if (confirmed) {
                model.reset()
            }
        })
    }

//
// ─── HELPERS ────────────────────────────────────────────────────────────────────
//

    function resetURL () {
        window.location.href = window.location.pathname
    }

    function length (x1, y1, x2, y2) {
        return Math.sqrt(Math.pow((x1 - x2), 2) + Math.pow((y1 - y2), 2))
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
        document.getElementById("help-screen").style.zIndex =
            (helpPageIsOpen ? 1 : -1) * 2000
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
                        emoji:      "🧨",
                        message:    "Are you sure about unlocking?",
                        yes:        "Unlock",
                        no:         "Stay Locked",
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
        strokeWeight(SELECTION_BOX_STROKE_WEIGHT)
        stroke(200 + (darkMode ? 0 : 30), 0, 0)
        fill(0, 0, 0, 0)

        // top left
        const topLeftX = x - SELECTION_PADDING
        const topLeftY = y - SELECTION_PADDING
        line(topLeftX, topLeftY, topLeftX + SELECTION_BOX_CORNER_SIZE, topLeftY)
        line(topLeftX, topLeftY, topLeftX, topLeftY + SELECTION_BOX_CORNER_SIZE)

        // top right
        const topRightX = topLeftX + 2 * SELECTION_PADDING + width
        const topRightY = topLeftY
        line(topRightX - SELECTION_BOX_CORNER_SIZE, topRightY, topRightX, topRightY)
        line(topRightX, topRightY, topRightX, topRightY + SELECTION_BOX_CORNER_SIZE)

        // bottom left
        const bottomLeftX = topLeftX
        const bottomLeftY = topLeftY + 2 * SELECTION_PADDING + height
        line(bottomLeftX, bottomLeftY, bottomLeftX + SELECTION_BOX_CORNER_SIZE, bottomLeftY)
        line(bottomLeftX, bottomLeftY - SELECTION_BOX_CORNER_SIZE, bottomLeftX, bottomLeftY)

        // bottom right
        const bottomRightX = topRightX
        const bottomRightY = bottomLeftY
        line(bottomRightX, bottomRightY, bottomRightX - SELECTION_BOX_CORNER_SIZE, bottomRightY)
        line(bottomRightX, bottomRightY - SELECTION_BOX_CORNER_SIZE, bottomRightX, bottomRightY)
    }

//
// ─── SHARE ──────────────────────────────────────────────────────────────────────
//

    function shareWithURL() {
        askForConfirmation({
            emoji:      "🎾",
            message:    "Do you want to copy the share url to your clipboard?",
            yes:        "Copy",
            no:         "Stop",
        }).then(confirmed => {
            if (confirmed) {
                const okayButton = document.getElementById("dialog-okay-button")
                okayButton.setAttribute("data-clipboard-text",
                    "https://pink.pouya.us/?" + model.urlComponent
                )

                const clipboard = new ClipboardJS("#dialog-okay-button")

                clipboard.on('success', event => {
                    event.clearSelection()
                    okayButton.removeAttribute("data-clipboard-text")
                })

                clipboard.on('error', () => {
                    okayButton.removeAttribute("data-clipboard-text")
                })
            }
        })
    }

    function afterEdit() {
        window.location
    }

//
// ─── DIALOG ─────────────────────────────────────────────────────────────────────
//

    function askForConfirmation({ message, yes, no, emoji }) {
        return new Promise(returnConfirmation => {
            const container     = document.getElementById("dialog-container")
            const dialogEmoji   = document.getElementById("dialog-emoji")
            const messageBox    = document.getElementById("dialog-message")
            const okayButton    = document.getElementById("dialog-okay-button")
            const cancelButton  = document.getElementById("dialog-cancel-button")

            dialogEmoji.innerText   = emoji
            messageBox.innerText    = message
            okayButton.innerText    = yes
            cancelButton.innerText  = no

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
