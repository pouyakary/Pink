
const FACTORY_STROKE_SIZE = 9

var shapes = [[]]
var shouldAdd = false
var strokeSize = FACTORY_STROKE_SIZE

function setup() {
    loadState()
    createCanvas(window.innerWidth, window.innerHeight);
}

function draw() {
    background(0);
    strokeWeight(strokeSize);

    for (const shape of shapes) {
        let px = 0
        let py = 0
        let isNotFirst = false;
        for (const [x, y] of shape) {
            if (isNotFirst) {
                stroke(random(255), 0, random(255))
                line(px, py, x, y)
            }
            px = x
            py = y
            isNotFirst = true
        }
    }

    if (shouldAdd) {
        addToBuffer(mouseX, mouseY)
    }

    if (keyIsDown(LEFT_ARROW)) {
        undo()
    }

    saveState()
}

function mousePressed() {
  shapes.push([])
  shouldAdd = true
}

function mouseReleased() {
  shouldAdd = false
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