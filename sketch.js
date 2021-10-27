
//
// Copyright (c) 2021 - present by Pouya Kary <mail@pouya.us>
// This was written to learn P5 so I could show it to Zea <3
//


//
// ─── CONSTANTS ──────────────────────────────────────────────────────────────────
//

    const FACTORY_STROKE_SIZE = 9
    const MOUSE_ERASE_SENSITIVITY = FACTORY_STROKE_SIZE
    const MOUSE_HOVER_SENSITIVITY = 70
    const STORAGE_KEY = "model"

//
// ─── GLOBALS ────────────────────────────────────────────────────────────────────
//

    var model = null
    var shouldAdd = false
    var strokeSize = FACTORY_STROKE_SIZE
    var eraseMode = false
    var canvas = null
    var selectedShapeIndex = -1
    var somethingIsSelected = false

//
// ─── SHAPE ──────────────────────────────────────────────────────────────────────
//

    class Shape {
        constructor(initial) {
            this.points = initial ? initial : []
        }

        append(x, y) {
            this.points.push([x, y])
        }

        read(index) {
            this.points[index]
        }

        get size() {
            return this.points.length
        }

        get isShapeUnderCursor() {
            for (const [x, y] of this.points) {
                const l = Math.sqrt(Math.pow((x - mouseX), 2) + Math.pow((y - mouseY), 2))
                if (l < MOUSE_ERASE_SENSITIVITY) {
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

        removeLastPoint() {
            this.points.pop()
        }
    }

//
// ─── MODEL ──────────────────────────────────────────────────────────────────────
//

    class Model {
        constructor() {
            this.shapes = []
            this.loadPreviousState()
        }

        addEmptyShape() {
            this.shapes.push(new Shape())
        }

        addToBuffer(x, y) {
            this.shapes[this.shapes.length - 1].append(x, y)
        }

        loadPreviousState() {
            const state = getItem(STORAGE_KEY)
            if (state !== null && state !== undefined && state !== "") {
                this.shapes = JSON.parse(state).map(raw => new Shape(raw))
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

        removeSelectedShape() {
            if (selectedShapeIndex >= 0) {
                const newShapes = []
                for (let i = 0; i < this.shapes.length; i++) {
                    if (i !== selectedShapeIndex) {
                        newShapes.push(this.shapes[i])
                    }
                 }
                this.shapes = newShapes
            }
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
            this.shapes = [new Shape()]
            this.storeCurrentState
        }
    }

//
// ─── PROCESSING MAIN ────────────────────────────────────────────────────────────
//

    function setup() {
        model = new Model()
        createCanvas(window.innerWidth, window.innerHeight);
        canvas = document.querySelector("canvas")
        document.addEventListener('contextmenu', event => event.preventDefault())
    }

    function draw() {
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

            shape.draw(shouldAllShapeBeSelected)
            shapeIndex++
        }

        setCursor(somethingIsSelected)

        if (!somethingIsSelected) {
            selectedShapeIndex = -1
        }

        if (shouldAdd && focused && !eraseMode) {
            model.addToBuffer(mouseX, mouseY)
        }

        if (!focused) {
            shouldAdd = false
        }

        if (keyIsDown(LEFT_ARROW)) {
            model.undo()
        }

        model.storeCurrentState()
    }

//
// ─── EVENTS ─────────────────────────────────────────────────────────────────────
//

    function mousePressed() {
        if (focused) {
            if (mouseButton === RIGHT) {
                eraseMode = !eraseMode
            } else {
                if (eraseMode) {
                    if (somethingIsSelected) {
                        model.removeSelectedShape( )
                    }
                } else {
                    model.addEmptyShape()
                    shouldAdd = true
                }
            }
        }
    }

    function mouseReleased() {
        if (focused) {
            shouldAdd = false
        }
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

    function setCursor(isSelecting) {
        if (eraseMode) {
            canvas.style.cursor = isSelecting ? "pointer" : "default"
        } else {
            canvas.style.cursor = "crosshair"
        }
    }

    function decideColor (x, y, shouldAllShapeBeSelected) {
        const radius = Math.sqrt(Math.pow((x - mouseX), 2) + Math.pow((y - mouseY), 2))
        const green = () => stroke(0, random(255), random(100))
        const pink = () => stroke(random(255), 0, random(255))
        if (eraseMode) {
            shouldAllShapeBeSelected ? green() : pink()
        } else {
            radius < MOUSE_HOVER_SENSITIVITY ? green() : pink()
        }
    }

    function applyMode() {
        const button = document.getElementById("mode-button")
        button.innerText = eraseMode ? "ERASE MODE" : "DRAW MODE"
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
        strokeSize = FACTORY_STROKE_SIZE
        model.reset()
    }

// ────────────────────────────────────────────────────────────────────────────────
