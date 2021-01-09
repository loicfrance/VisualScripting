import {Vec2} from "../../../jslib/geometry2d/Vec2.mod.js";
import {MouseButton} from "../../../jslib/utils/input.mod.js";
import {debug} from "../../../jslib/utils/tools.mod.js"
import {FbpConnection} from "../FBP/fbp.mod.js";

const startPosSym = Symbol();
const endPosSym = Symbol();
const rectSym = Symbol();

const SVG_NS = "http://www.w3.org/2000/svg";

const templateSVG = document.querySelector("#connections-template").content.firstElementChild;
const templatePath = templateSVG.querySelector('.connection');
templateSVG.removeChild(templatePath);

/**
 * @deprecated
 */
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
const startPortSym = Symbol();
const endPortSym = Symbol();
const selectedSym = Symbol("selected");

const magnetSym = Symbol("attached to a port");

class ConnectionCreator {
    path = templatePath.cloneNode(true);
    /**
     * @type {PortDisplay}
     */
    beginPort;
    [startPosSym] = undefined;
    [endPosSym] = undefined;
    /** @type {boolean} */
    [magnetSym] = false;

    /**
     *
     * @param {DesignBoard} board
     * @param {PortDisplay} port1
     */
    constructor(board, port1) {
        this.beginPort = port1;
        this.path.style.stroke = this.beginPort.dataType.getAttr('color', '#F0F');
        this.path.style.pointerEvents = 'none';
        this.path.style.strokeDashoffset = '50%';
        this[endPosSym] = port1.position.clone();
        this[startPosSym] = port1.position.clone();
        this.onPortHover(null);
        board.viewPort.addConnection(this);
        debug.log("VS-debug", "create connection");
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
     * @param {PortDisplay} port
     */
    onPortHover(port) {
        if(port) {
            this.update(port.position);
            this[magnetSym] = true;
            if(!port.fbpPort.connectionFull && this.beginPort.fbpPort.canConnect(port.fbpPort)) {
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
        const canConnect =
            !port.fbpPort.connectionFull &&
            (this.beginPort !== port) &&
            this.beginPort.fbpPort.canConnect(port.fbpPort) &&
            !this.beginPort.fbpPort.connectedTo(port.fbpPort);

        if(canConnect) {
            this.beginPort.fbpPort.connect(port.fbpPort);
            if(!evt.shiftKey) {
                this.delete();
                return undefined;
            }
        }
        return this;
    }

    delete() {
        debug.log("VS-debug", "finish connection creation");
        board.viewPort.removeConnection(this);
    }
}

/**
 * @class ConnectionDisplay
 * @extends FbpObjectDisplay
 */
class ConnectionDisplay {
    path = templatePath.cloneNode(true);
    /** @type {FbpConnection} */
    [connSym];
    [startPortSym];
    [endPortSym];
    [selectedSym] = false;

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
        this[startPortSym] = board.getProcessDisplay(connection.startProcess).port(connection.startPort);
        this[endPortSym] = board.getProcessDisplay(connection.endProcess).port(connection.endPort);
        // noinspection JSValidateTypes
        this.fbpConnection.display = this;
        this.update();
        this.path.addEventListener('click', this[clickListenerSym]);
        board.viewPort.addConnection(this);
    }

//######################################################################################################################
//#                                                     ACCESSORS                                                      #
//######################################################################################################################

    /** @type {FbpConnection} */
    get fbpConnection() { return this[connSym]; }

    /** @type {ProcessDisplay} */
    get startProcess() { return this.startPort.process; }
    get endProcess() { return this.endPort.process; }

    /** @type {PortDisplay} */
    get startPort() { return this[startPortSym]; }
    /** @type {PortDisplay} */
    get endPort() { return this[endPortSym]; }

    get startPosition() { return this.startPort.position; }
    get endPosition() { return this.endPort.position; }

    get active() { return this.fbpConnection.active; }
    get passive() { return this.fbpConnection.passive; }

    get startType() { return this.fbpConnection.startPort.dataType; }
    get endType() { return this.fbpConnection.startPort.dataType; }

    get board() { return this.startPort.process.board; }

    get selected() {
        return this[selectedSym];
    }
    set selected(value) {
        this[selectedSym] = value;
        if(value)
            this.path.style.strokeDasharray = "5,5";
        else
            this.path.style.removeProperty('stroke-dasharray');
    }

//######################################################################################################################
//#                                                   OTHER METHODS                                                    #
//######################################################################################################################

    delete() {
        this[connSym].delete();
    }

    onDestroy() {
        debug.log("VS-debug", "connection delete: " + this);
        if(this.path) {
            if(this.selected)
                this.board.unselect(this);
            this.path.removeEventListener('click', this[clickListenerSym]);
            this.board.viewPort.removeConnection(this);
            this.path = null;
        }
    }
    onChange(reason, ...args) {
        this.update();
    }
    update() {
        this.path.setAttribute('d', getPath(this.startPosition, this.endPosition));
        this.path.setAttribute('stroke', this.startType.getAttr('color', '#F0F'));
    }
}

export default ConnectionDisplay;
export {
    ConnectionDisplay,
    ConnectionCreator,
    ConnectionsManager,
};