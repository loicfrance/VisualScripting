import {Vec2, Rect} from "../../../jsLibs_Modules/geometry2d/geometry2d.mod.js";
import {MouseButton} from "../../../jsLibs_Modules/utils/input.mod.js";
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
        this.selectedLayer = templateSVG.cloneNode(true);
        this.selectedLayer.classList.add('selected');
        this.elmt.addEventListener('click', console.log);
    }
    update(zoomFactor, visibleRect) {
        this.elmt.setAttribute("viewBox",
            `${visibleRect.xMin} ${visibleRect.yMin} ${visibleRect.width} ${visibleRect.height}`);
        this.selectedLayer.setAttribute("viewBox",
            `${visibleRect.xMin} ${visibleRect.yMin} ${visibleRect.width} ${visibleRect.height}`);
    }
    addToSelected(connection) {
        this.selectedLayer.appendChild(connection.path);
    }
    addToUnselected(connection) {
        this.elmt.appendChild(connection.path);
    }
    isSelected(connection) {
        return connection.path.parentElement === this.selectedLayer;
    }
    removeConnection(connection) {
        connection.path.parentElement.removeChild(connection.path);
    }
}

function getPath(from, to, rect) {

    let dx = (to.x - from.x);
    let dy = (to.y - from.y);

    if(dy === 0 && dx >= 0) return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
    if(dx < 0) {
        const center = from.clone().add(Vec2.translation(from, to).mul(0.5));
        let ctrl;
        let ratio;
        if(dy >= 0) {
            ctrl = new Vec2(from.x + 30, from.y + 30);
            if(dy === 0) {
                center.addXY(0, 30);
            }
        }
        else
            ctrl = new Vec2(from.x + 30, from.y - 30);

        return `M${from.x} ${from.y}C${from.x+30} ${from.y},${ctrl.x} ${ctrl.y},${center.x} ${center.y}
                S${to.x-30} ${to.y}, ${to.x} ${to.y}`;
    } else {
        let ratio = Math.abs(dx/dy);
        let offset =  ratio > 0.5 ? Math.max(dx*2/5, 20) : 40 - Math.min(40, ratio*40);
        //if(dx < 40) dx = 40 + (40-Math.max(dx, -40)) * 2;
        if(rect) {
            rect.xMin = Math.min(from.x, to.x-dx);
            rect.xMax = Math.max(from.x+dx, to.x);
            rect.yMin = Math.min(from.y, to.y);
            rect.yMax = Math.max(from.y, to.y);
        }
        return `M ${from.x} ${from.y} C ${from.x+offset} ${from.y}, ${to.x-offset} ${to.y}, ${to.x} ${to.y}`;
    }

}

const connSym = Symbol();
const clickListenerSym = Symbol();
const boardSym = Symbol();

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
        this.path.style.strokeDashoffset = '50%';
        this[port1.input ? endPosSym : startPosSym] = port1.position.clone();
        this[port1.input ? startPosSym : endPosSym] = port1.position.clone();
        this.onPortHover(null);
        board.connectionsManager.addToUnselected(this);
    }
    update(mousePos) {
        if(this[magnetSym] === false) {
            this[this.beginPort.input ? startPosSym : endPosSym].set(mousePos);
            this.path.setAttribute('d', getPath(this[startPosSym], this[endPosSym]));
        }
    }

    onPortMouseEvent(port, evt) {
        switch(evt.type) {
            case 'mouseenter'   : this.onPortHover(port); return this;
            case 'mouseout'     : this.onPortHover(null); return this;
            case 'mousedown'    :
            case 'mouseup'      :
                if(MouseButton.getEventSource(evt) === MouseButton.LEFT)
                    return this.onPortClick(port, evt);
                else return this;
            default : return this;
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
        if(this.beginPort !== port && !port.connectionFull
                && this.beginPort.canConnect(port) && !this.beginPort.connectedTo(port)) {
            this.beginPort.connect(port);
            if(!evt.shiftKey) {
                this.delete();
                return undefined;
            }
        }
        return this;
    }

    delete() {
        this.path.parentElement.removeChild(this.path);
    }
}

class DesignConnection {
    path = templatePath.cloneNode(true);
    /** @type {FbpConnection} */
    [connSym];

    [clickListenerSym] = (function(evt) {
        // noinspection JSCheckFunctionSignatures
        this.startPort.process.board.onObjectClick(this, evt);
    }).bind(this);

    /**
     * @constructor
     * @param {DesignBoard} board
     * @param {FbpConnection} connection
     */
    constructor(board, connection) {
        this[connSym] = connection;
        this.update();
        this.path.addEventListener('click', this[clickListenerSym]);
        board.connectionsManager.addToUnselected(this);
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

    get [boardSym]() {
        return this.startProcess.board;
    }

    delete(invokePortsDisconnect = true) {
        if(this.path) {
            if(this.selected)
                this[boardSym].unselect(this);
            this.path.removeEventListener('click', this[clickListenerSym]);
            this.path.parentElement.removeChild(this.path);
            this.path = null;
            this[connSym].delete();
            if(invokePortsDisconnect)
                this.startPort.disconnect(this.endPort, false);
        }
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
    set selected(value) {
        if(value) {
            this[boardSym].connectionsManager.addToSelected(this);
        } else {
            this[boardSym].connectionsManager.addToUnselected(this);
        }
    }
    get selected() {
        return this[boardSym].connectionsManager.isSelected(this);
    }
}

export default DesignConnection;
export {
    DesignConnection,
    ConnectionCreator,
    ConnectionsManager,
};