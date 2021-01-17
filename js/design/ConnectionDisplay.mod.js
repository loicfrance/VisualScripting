import {Vec2} from "../../../jslib/geometry2d/Vec2.mod.js";
import {MouseButton} from "../../../jslib/utils/input.mod.js";
import {debug, htmlToElements} from "../../../jslib/utils/tools.mod.js"
import {FbpConnection} from "../FBP/fbp.mod.js";
import {DesignActions} from "./DesignSheet.mod.js";
import PortDisplay from "./PortDisplay.mod.js";

const startPosSym = Symbol();
const endPosSym = Symbol();
const rectSym = Symbol();

const SVG_NS = "http://www.w3.org/2000/svg";

const [{firstChild: templatePath}] = htmlToElements(`
<svg><path class="connection" stroke="white" d=""/></svg>
`);

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
const onPortHover = Symbol("on Port Hover");
const onPortClick = Symbol("on Port Click");
const mouseMoveListenerSym = Symbol("mouse move listener");

const magnetSym = Symbol("attached to a port");

class ConnectionCreator {
    // noinspection JSValidateTypes
    /** @type {SVGElement} */
    path = templatePath.cloneNode(true);
    /**
     * @type {PortDisplay}
     */
    beginPort;
    [startPosSym] = undefined;
    [endPosSym] = undefined;
    /** @type {boolean} */
    [magnetSym] = false;
    [mouseMoveListenerSym];

    /**
     * @param {PortDisplay} port1
     */
    constructor(port1) {
        this.beginPort = port1;
        this.path.style.stroke = this.beginPort.dataType.getAttr('color', '#F0F');
        this.path.style.pointerEvents = 'none';
        this.path.style.strokeDashoffset = '50%';
        this[endPosSym] = port1.position.clone();
        this[startPosSym] = port1.position.clone();
        this[onPortHover](null);
    }

    show() {
        this.beginPort.designSheet.addOverlaySVGElement(this.path);
    }
    hide() {
        this.beginPort.designSheet.removeOverlaySVGElement(this.path);
    }
    followCursor() {
        if (!this[mouseMoveListenerSym]) {
            this[mouseMoveListenerSym] = (evt)=> {
                const pos = this.beginPort.designSheet.pageToFBPCoordinates(evt.pageX, evt.pageY);
                this.update(pos);
            }
        }
        window.addEventListener('mousemove', this[mouseMoveListenerSym]);
    }
    unFollowCursor() {
        if (this[mouseMoveListenerSym])
           window.removeEventListener('mousemove', this[mouseMoveListenerSym]);
    }

    update(mousePos) {
        if(this[magnetSym] === false) {
            if (this.beginPort.input) {
                this[startPosSym].set(mousePos);
                this[endPosSym].set(this.beginPort.position);
            } else {
                this[endPosSym].set(mousePos);
                this[startPosSym].set(this.beginPort.position);
            }
            this.path.setAttribute('d', getPath(this[startPosSym], this[endPosSym]));
        }
    }

    onPortMouseEvent(port, evt) {
        if(port.designSheet !== this.beginPort.designSheet)
            return false;
        switch(evt.type) {
            case 'mouseenter'   : this[onPortHover](port); return this;
            case 'mouseout'     : this[onPortHover](null); return this;
            case 'mousedown'    :
            case 'mouseup'      :
                if(MouseButton.getEventSource(evt) === MouseButton.LEFT)
                    return this[onPortClick](port, evt);
                else return this;
            default : return this;
        }
    }
    canConnect(port) {
        if(port instanceof PortDisplay)
            port = port.fbpPort;
        return !port.connectionFull &&
            (this.beginPort !== port.display) &&
            this.beginPort.fbpPort.canConnect(port) &&
            !this.beginPort.fbpPort.connectedTo(port);
    }
    connect(port) {
        if(port instanceof PortDisplay)
            port = port.fbpPort;
        if(this.canConnect(port)) {
            this.beginPort.fbpPort.connect(port);
        }
    }

    /**
     * @param {PortDisplay} port
     */
    [onPortHover](port) {
        if(port) {
            this.update(port.position);
            this[magnetSym] = true;
            if(this.canConnect(port)) {
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

    /**
     * @param {PortDisplay} port
     * @param {MouseEvent} evt
     */
    [onPortClick](port, evt) {
        if(this.canConnect(port)) {
            this.connect(port.fbpPort);
            if(!evt.shiftKey) {
                this.beginPort.designSheet.editor.stopConnectionCreation();
                return undefined;
            }
        }
        return this;
    }

    delete() {
        this.unFollowCursor();
        this.hide();
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
        this.designSheet.editor.onObjectClick(this, evt);
    }).bind(this);

    /**
     * @constructor
     * @param {DesignSheet} designSheet
     * @param {FbpConnection} connection
     */
    constructor(designSheet, connection) {
        this[connSym] = connection;
        this[startPortSym] = designSheet.getProcessDisplay(connection.startProcess).port(connection.startPort);
        this[endPortSym] = designSheet.getProcessDisplay(connection.endProcess).port(connection.endPort);
        // noinspection JSValidateTypes
        this.fbpConnection.display = this;
        this.update();
        this.path.addEventListener('click', this[clickListenerSym]);
        this.path.addEventListener('mouseenter', (evt)=>
            this.designSheet.editor?.onObjectHover(this));
        this.path.addEventListener('mouseout', (evt)=>
            this.designSheet.editor?.onObjectHover(undefined));
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

    get designSheet() { return this.startPort.process.designSheet; }

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
        if(this.selected)
            this.designSheet.unselect(this);
        this.path.removeEventListener('click', this[clickListenerSym]);
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
};