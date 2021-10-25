var shapes = [[]]

var shouldAdd = false

function setup() {
    createCanvas(window.innerWidth, window.innerHeight);
    strokeWeight(7);
}

function draw() {
    background(0);

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
        undo();
    }
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