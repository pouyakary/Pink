
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
    const SELECTION_PADDING = 20
    const SELECTION_BOX_CORNER_SIZE = 15
    const SELECTION_BOX_STROKE_WEIGHT = 4
    const DARK_PINK_DELTA = 130

//
// ─── GLOBALS ────────────────────────────────────────────────────────────────────
//

    var model = null
    var shouldActOnMouseHover = false
    var strokeSize = FACTORY_STROKE_SIZE
    var eraseMode = false
    var canvas = null
    var selectedShapeIndex = -1
    var somethingIsSelected = false
    var frameThatEnteredErase = 0
    var htmlSectionIsActive = false
    var helpPageIsOpen = false

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

            const strokeSizeBoundary = strokeSize - 1
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
            drawSelectionBox(x, y, width, height)
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

        loadPreviousState() {
            const state = JSON.parse(getItem(STORAGE_KEY))
            const shapes = []
            if (state !== null && state !== undefined && state !== "" && state instanceof Array) {
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
                    shapes.push(new Shape(shapeRAW))
                }
                this.shapes = shapes
            }
        }

        storeCurrentState() {
            storeItem(STORAGE_KEY, JSON.stringify(this.shapes.map(shape => shape.points)))
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
        }

        garbageCollect() {
            for (let index = 0; index < this.shapes.length; index++) {
                if (this.shapes[index].size < 2) {
                    this.removeShapeAtIndex(index)
                }
            }
        }
    }

//
// ─── PROCESSING MAIN ────────────────────────────────────────────────────────────
//

    function setup() {
        model = new Model()
        createCanvas(window.innerWidth, window.innerHeight);
        canvas = document.querySelector("canvas")
        registerEvents()
    }

    function registerEvents() {
        const disable = event => event.preventDefault()
        document.addEventListener("contextmenu", disable)
        document.addEventListener("click", disable)
    }


    function draw() {
        renderHelpPageBasedOnState()
        applyMode()
        background(0)
        strokeWeight(strokeSize)

        somethingIsSelected = false
        let shapeIndex = 0

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


        if (!shouldNotHandleTheMouse() && shouldActOnMouseHover) {
            if (eraseMode) {
                if (somethingIsSelected) {
                    model.removeSelectedShape( )
                }
            } else {
                model.addToBuffer(mouseX, mouseY)
            }
        }

        if (!focused) {
            shouldActOnMouseHover = false
        }

        if (keyIsDown(LEFT_ARROW)) {
            model.undo()
        }

        model.storeCurrentState()
    }

//
// ─── EVENTS ─────────────────────────────────────────────────────────────────────
//

    function shouldNotHandleTheMouse() {
        return htmlSectionIsActive || !focused || helpPageIsOpen
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

    function keyTyped() {
        if (key === "1") {
            undo()
        }
        if (key === "2") {
            undoLastShape()
        }
        if (key === "3") {
            incrementSize()
        }
        if (key === "4") {
            decrementSize()
        }
    }

    function windowResized() {
        resizeCanvas(windowWidth, windowHeight)
    }

    function incrementSize() {
        strokeSize++
    }

    function decrementSize() {
        if (strokeSize > 1) {
            strokeSize--
        }
    }

    function toggleEraseDrawMode() {
        eraseMode = !eraseMode
    }

//
// ─── DRAW HELPERS ───────────────────────────────────────────────────────────────
//

    function setCursor() {
        canvas.classList.remove("drawing-cursor")
        canvas.classList.remove("erasing-cursor")
        if (eraseMode) {
            canvas.classList.add("erasing-cursor")
        } else {
            canvas.classList.add("drawing-cursor")
        }
    }

    function decideColor (x, y, shouldAllShapeBeSelected) {
        if (eraseMode) {
            if (somethingIsSelected) {
                if (shouldAllShapeBeSelected) {
                    stroke(random(155) + 100, 0, 0) // red
                } else {
                    stroke(random(255 - DARK_PINK_DELTA), 0, random(255 - DARK_PINK_DELTA)) // dark pin
                }
            } else {
                // normal erase mode
                stroke(random(255), 0, random(255)) // pink
            }
        } else {
            const radius = length(x, y, mouseX, mouseY)
            if (radius < MOUSE_HOVER_SENSITIVITY) {
                stroke(0, random(255), random(100)) // green
            } else {
                stroke(random(255), 0, random(255)) // pink
            }
        }
    }

    function applyMode() {
        const button = document.getElementById("status")
        if (shouldActOnMouseHover) {
            button.innerHTML = eraseMode ? "ERASING" : "DRAWING"
        } else {
            button.innerHTML = eraseMode ? "ERASE MODE" : "DRAW MODE"
        }
        if ( eraseMode ) {
            button.classList.add("red")
        } else {
            button.classList.remove("red")
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
        if (confirm('🧨 Are you sure about cleaning all the screen?')) {
            strokeSize = FACTORY_STROKE_SIZE
            model.reset()
        }
    }


//
// ─── HELPERS ────────────────────────────────────────────────────────────────────
//

    function length (x1, y1, x2, y2) {
        return Math.sqrt(Math.pow((x1 - x2), 2) + Math.pow((y1 - y2), 2))
    }

    function handleClick(func) {
        setTimeout(() => func())
    }

    function renderHelpPageBasedOnState() {
        document.getElementById("help-screen").hidden = !helpPageIsOpen
    }

//
// ─── DRAWING HELPERS ────────────────────────────────────────────────────────────
//

    function drawSelectionBox(x, y, width, height) {
        strokeWeight(SELECTION_BOX_STROKE_WEIGHT)
        stroke(200, 0, 0)
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

// ────────────────────────────────────────────────────────────────────────────────
