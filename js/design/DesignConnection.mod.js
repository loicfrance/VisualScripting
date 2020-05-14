import {Vec2, Rect} from "../../../jsLibs_Modules/geometry2d/geometry2d.mjs";
import {FbpConnection, FbpPacketConnection, FbpPassiveConnection} from "../FBP/fbp.mod.js";

const startPosSym = Symbol();
const endPosSym = Symbol();
const rectSym = Symbol();

const SVG_NS = "http://www.w3.org/2000/svg";

const templateSVG = document.querySelector("#connections-template").content.firstElementChild;
const templatePath = templateSVG.querySelector('.connection');
templateSVG.removeChild(templatePath);

class ConnectionsManager {
    constructor() {
        this.elmt = templateSVG.cloneNode(true);
        this.elmt.addEventListener('click', console.log);
    }
    update(zoomFactor, visibleRect) {
        this.elmt.setAttribute("viewBox",
            `${visibleRect.xMin} ${visibleRect.yMin} ${visibleRect.width} ${visibleRect.height}`);
    }
    showConnection(connection) {
        this.elmt.appendChild(connection.path);
    }
    hideConnection(connection) {
        this.elmt.removeChild(connection.path);
    }
}

function getPath(from, to, rect) {

    let dx = (to.x - from.x)*2/5;
    if(dx < 40) dx = 40 + (40-Math.max(dx, -40)) * 2;
    if(rect) {
        rect.xMin = Math.min(from.x, to.x-dx);
        rect.xMax = Math.max(from.x+dx, to.x);
        rect.yMin = Math.min(from.y, to.y);
        rect.yMax = Math.max(from.y, to.y);
    }
    return `M ${from.x} ${from.y} C ${from.x+dx} ${from.y}, ${to.x-dx} ${to.y}, ${to.x} ${to.y}`;
}

const connSym = Symbol();

const magnetSym = Symbol("attached to a port");

class ConnectionCreator {
    path = templatePath.cloneNode(true);
    /**
     * @type {DesignPort}
     */
    beginPort;
    [startPosSym] = undefined;
    [endPosSym] = undefined;
    /** @type {boolean} */
    [magnetSym] = false;

    /**
     *
     * @param {DesignBoard} board
     * @param {DesignPort} port1
     */
    constructor(board, port1) {
        this.beginPort = port1;
        this.path.style.stroke = this.beginPort.type.color;
        this.path.style.pointerEvents = 'none';
        this.path.style.strokeDasharray = "15, 15";
        this.path.style.strokeDashoffset = '50%';
        this.path.style.opacity = "0.7";
        this[port1.input ? endPosSym : startPosSym] = port1.position.clone();
        this[port1.input ? startPosSym : endPosSym] = port1.position.clone();
        board.connectionsManager.showConnection(this);
    }
    update(mousePos) {
        if(this[magnetSym] === false) {
            this[this.beginPort.input ? startPosSym : endPosSym].set(mousePos);
            this.path.setAttribute('d', getPath(this[startPosSym], this[endPosSym]));
        }
    }

    /**
     * @param {DesignPort} port
     */
    onPortHover(port) {
        if(port) {
            this.update(port.position);
            this[magnetSym] = true;
            if(this.beginPort.canConnect(port) && !port.connectionFull) {
                this.path.style.strokeDasharray = "20, 10";
                this.path.style.opacity = "1";
            } else {
                this.path.style.strokeDasharray = "10, 20";
                this.path.style.opacity = "0.3";
            }
        } else {
            this[magnetSym] = false;
            this.path.style.strokeDasharray = "15, 15";
            this.path.style.opacity = "0.7";
        }
    }

    onPortClick(port, evt) {
        if(this.beginPort !== port && !port.connectionFull && this.beginPort.canConnect(port)) {
            this.beginPort.connect(port);
            if(!evt.shiftKey) {
                this.destroy();
                return undefined;
            }
        }
        return this;
    }

    destroy() {
        this.path.parentElement.removeChild(this.path);
    }
}
class DesignConnection {
    path = templatePath.cloneNode(true);
    /** @type {FbpConnection} */
    [connSym];

    /**
     * @constructor
     * @param {DesignBoard} board
     * @param {FbpConnection} connection
     */
    constructor(board, connection) {
        this[connSym] = connection;
        this.update();
        board.connectionsManager.showConnection(this);
    }
    get fbpConnection() { return this[connSym]; }
    get startProcess() { return this[connSym].startPort.process  }
    get endProcess() { return this[connSym].endPort.process; }

    get startPort() { return this.startProcess.outputPort(this[connSym].startPort.name); }
    get endPort() { return this.endProcess.inputPort(this[connSym].endPort.name); }

    get startPosition() { return this.startPort.position; }
    get endPosition() { return this.endPort.position; }

    get active() { return this[connSym] instanceof FbpPacketConnection; }
    get passive() { return this[connSym] instanceof FbpPassiveConnection; }

    get startType() { return this[connSym].startPort.type; }
    get endType() { return this[connSym].startPort.type; }

    destroy() {
        this[connSym].destroy();
        this.path.parentElement.removeChild(this.path);
    }
    update() {
        this.path.setAttribute('d', getPath(this.startPosition, this.endPosition));
        this.path.setAttribute('stroke', this.startType.color);
    }

    /**
     * @param {DesignPort} port1
     * @param {DesignPort} port2
     * @returns {boolean}
     */
    connects(port1, port2)
    {
        return port1.output ?
            this.startPort === port1 && this.endPort === port2
            : this.startPort === port2 && this.endPort === port1;
    }
}

export default DesignConnection;
export {
    DesignConnection,
    ConnectionCreator,
    ConnectionsManager,
};