
const FACTORY_STROKE_SIZE = 9
const MOUSE_ERASE_SENSITIVITY = 30

var shapes = [[]]
var shouldAdd = false
var strokeSize = FACTORY_STROKE_SIZE
var eraseMode = false
var canvas = null
var selectedShapeIndex = -1
var somethingIsSelected = false

function setup() {
    loadState()
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

    for (const shape of shapes) {
        const shouldAllShapeBeSelected = eraseMode && isShapeUnderCursor(shape)
        if (shouldAllShapeBeSelected) {
            somethingIsSelected = true
            selectedShapeIndex = shapeIndex
        }

        let px = 0
        let py = 0
        let isNotFirst = false

        for (const [x, y] of shape) {
            if (isNotFirst) {
                decideColor(x, y, shouldAllShapeBeSelected)
                line(px, py, x, y)
            }
            px = x
            py = y
            isNotFirst = true
        }

        shapeIndex++
    }

    canvas.style.cursor = somethingIsSelected ? "pointer" : "crosshair"

    if (!somethingIsSelected) {
        selectedShapeIndex = -1
    }

    if (shouldAdd && focused && !eraseMode) {
        addToBuffer(mouseX, mouseY)
    }

    if (!focused) {
        shouldAdd = false
    }

    if (keyIsDown(LEFT_ARROW)) {
        undo()
    }

    saveState()
}

function isCanvasSelecting(isSelecting) {
    canvas.style.cursor = isSelecting ? "pointer" : "crosshair"
}


function isShapeUnderCursor(shape) {
    for (const [x, y] of shape) {
        const l = Math.sqrt(Math.pow((x - mouseX), 2) + Math.pow((y - mouseY), 2))
        if (l < MOUSE_ERASE_SENSITIVITY) {
            return true
        }
    }
    return false
}


function mousePressed() {
    if (focused) {
        if (mouseButton === RIGHT) {
            eraseMode = !eraseMode
        } else {
            if (eraseMode) {
                if (somethingIsSelected) {
                    removeSelectedShape( )
                }
            } else {
                shapes.push([])
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

function decideColor (x, y, shouldAllShapeBeSelected) {
    const radius = Math.sqrt(Math.pow((x - mouseX), 2) + Math.pow((y - mouseY), 2))
    const green = () => stroke(0, random(255), random(100))
    const pink = () => stroke(random(255), 0, random(255))
    if (eraseMode) {
        shouldAllShapeBeSelected ? green( ) : pink( )
    } else {
        radius < 50 ? green( ) : pink( )
    }
}

function addToBuffer(x, y) {
  shapes[shapes.length - 1].push([x, y])
}


function undo() {
    const last = shapes[shapes.length - 1]
    if (last.length > 0) {
        last.pop()
    } else {
        shapes.pop()
        if (shapes.length === 0) {
            shapes.push([])
        }
    }
}

function undoLastShape() {
    if (shapes.length > 1) {
        shapes.pop()
    }
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight)
}


function saveState() {
    storeItem("shapes", JSON.stringify(shapes))
}

function loadState() {
    const state = getItem("shapes")
    if (state !== null && state !== undefined && state !== "") {
        shapes = JSON.parse(state)
    }
}

function reset() {
    strokeSize = FACTORY_STROKE_SIZE
    shapes = [[]]
    saveState()
}

function incrementSize ( ) {
    strokeSize++
}

function decrementSize( ) {
    if (strokeSize > 1) {
        strokeSize--
    }
}

function toggleEraseDrawMode() {
    eraseMode = !eraseMode
}

function applyMode () {
    const button = document.getElementById("mode-button")
    button.innerText = eraseMode ? "ERASE MODE" : "DRAW MODE"
}

function removeSelectedShape() {
    if (selectedShapeIndex >= 0) {
        const newShapes = []
        for (let i = 0; i < shapes.length; i++) {
            if (i !== selectedShapeIndex) {
                newShapes.push(shapes[i])
            }
        }
        shapes = newShapes
    }
}