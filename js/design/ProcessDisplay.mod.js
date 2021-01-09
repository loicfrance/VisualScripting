import {Rect} from "../../../jslib/geometry2d/Rect.mod.js";
import {Vec2} from "../../../jslib/geometry2d/Vec2.mod.js";
import {hexToRGBA, luminance} from "../../../jslib/utils/colors.mod.js";
import FbpPort, {FbpPortDirection as PORT_DIR} from "../FBP/FbpPort.mod.js";
import {FbpProcessChangeReason as ChangeReason} from "../FBP/FbpProcess.mod.js";
import PortDisplay from "./PortDisplay.mod.js";

const CLICK_MOVE_SQUARE_LIMIT = (2)**2;

const boardSym = Symbol("design board");
const fbpProcessSym = Symbol("FBP process");
const inputPortDisplaysSym = Symbol("input port displays");
const outputPortDisplaysSym = Symbol("output port displays");

const htmlElmtSym = Symbol("HTML element");
const titleElmtSym = Symbol("HTML title element");
const inputPortsDivSym = Symbol("input ports HTML container");
const outputPortsDivSym = Symbol("output ports HTML container");
const operationDivSym = Symbol("operation HTML div");
const detailsDivSym = Symbol("details HTML div");
const positionSym = Symbol("position");
const createPortDisplaySym = Symbol("create PortDisplay for FbpPort");
const removePortDisplaySym = Symbol("remove PortDisplay for FbpPort");
const onDbClickSym = Symbol("Double click listener");

const processTemplate = document.querySelector('#process-template').content.firstElementChild;
// noinspection JSUnusedLocalSymbols
const detailsTemplate = document.querySelector('#process-details-template').content.firstElementChild;

/** @implements {FbpObjectDisplay} */
class ProcessDisplay {
    [boardSym];
    [fbpProcessSym];
    [inputPortDisplaysSym] = new Map();
    [outputPortDisplaysSym] = new Map();
    [positionSym] = Vec2.zero;

    [htmlElmtSym] = processTemplate.cloneNode(true);
    [titleElmtSym] = this[htmlElmtSym].querySelector(".title");
    [inputPortsDivSym] = this[htmlElmtSym].querySelector(".ports.input");
    [outputPortsDivSym] = this[htmlElmtSym].querySelector(".ports.output");
    [operationDivSym] = this[htmlElmtSym].querySelector(".operation");
    [detailsDivSym] = this[htmlElmtSym].querySelector(".details");

//######################################################################################################################
//#                                                     LISTENERS                                                      #
//######################################################################################################################
    // noinspection JSUnusedGlobalSymbols
    [onDbClickSym] = (evt)=> {
        if(evt.target.isContentEditable)
            return;
        evt.preventDefault();
        //TODO see if port value edition is canceled
        this.showEditor();
    }

//######################################################################################################################
//#                                                    CONSTRUCTOR                                                     #
//######################################################################################################################
    constructor(board, fbpProcess, {...attributes}={}) {
        this[fbpProcessSym] = fbpProcess;
        this[boardSym] = board;
        const startPos = Vec2.zero;
        this.elmt.addEventListener('dblclick', this[onDbClickSym]);

        const onMove = (evt)=> {
            if(Vec2.squareDistance(startPos, new Vec2(evt.pageX, evt.pageY)) > 4) {
                this.elmt.removeEventListener('mousemove', onMove);
                this.elmt.removeEventListener('click', onClick);
            }
        };
        const onClick = (evt)=> {
            if (evt.shiftKey || evt.ctrlKey)
                this.board.unselect(this);
            else this.board.setSelection(this);
            this.elmt.removeEventListener('mousemove', onMove);
            this.elmt.removeEventListener('click', onClick);
        };
        this.elmt.addEventListener('mousedown', (evt)=> {
            if(!this.selected) {
                if(evt.shiftKey || evt.ctrlKey)
                    this.board.select(this);
                else this.board.setSelection(this);
            } else {
                startPos.setXY(evt.pageX, evt.pageY);
                this.elmt.addEventListener('mousemove', onMove);
                this.elmt.addEventListener('click', onClick);
            }
        });
        this.selected = false;
        this.fbpProcess.display = this;
        this.update();
        board.viewPort.addProcess(this);
    }

//######################################################################################################################
//#                                                     ACCESSORS                                                      #
//######################################################################################################################

    /** @type {FbpProcess} */
    get fbpProcess() { return this[fbpProcessSym]; }
    /** @type {HTMLElement} */
    get elmt() { return this[htmlElmtSym]; }
    /** @type {HTMLElement} */
    get titleElmt() { return this[titleElmtSym]; }
    /** @type {HTMLDivElement} */
    get inputPortsDiv() { return this[inputPortsDivSym]; }
    /** @type {HTMLDivElement} */
    get outputPortsDiv() { return this[outputPortsDivSym]; }
    /** @type {HTMLDivElement} */
    get operationDiv() { return this[operationDivSym]; }
    /** @type {HTMLDivElement} */
    get detailsDiv() { return this[detailsDivSym]; }

    set selected(value) {
        if(this.elmt.hasAttribute('selected') !== !!value)
            this.elmt.toggleAttribute('selected');
    }
    get selected() {
        return this.elmt.hasAttribute('selected');
    }
    get position() { return this[positionSym]; }
    set position(value) { return this[positionSym].set(value); }

    get color() { return this.fbpProcess.getAttr('color', '#FFF'); }
    set color(value) { this.fbpProcess.setAttr('color', value); }

    get visibleName() { return this.fbpProcess.getAttr('visible_name', true); }
    set visibleName(value) { this.fbpProcess.setAttr('visible_name', value); }

    get board() {
        return this[boardSym];
    }

//######################################################################################################################
//#                                                  PORTS MANAGEMENT                                                  #
//######################################################################################################################

    /**
     * @param {string} name - port name
     * @return {PortDisplay}
     */
    inputPort(name) {
        const fbpPort = this.fbpProcess.getPort(name, PORT_DIR.IN);
        if(fbpPort)
            return this[inputPortDisplaysSym].get(fbpPort);
        return undefined;
    }
    /**
     * @param {string} name - port name
     * @return {PortDisplay}
     */
    outputPort(name) {
        const fbpPort = this.fbpProcess.getPort(name, PORT_DIR.OUT);
        if(fbpPort)
            return this[outputPortDisplaysSym].get(fbpPort);
        return undefined;
    }
    /**
     * @param {string|FbpPort} port
     * @return {PortDisplay|undefined}
     */
    port(port) {
        if (port.substr)
            port = this.fbpProcess.getPort(name);
        return this[port.input ? inputPortDisplaysSym : outputPortDisplaysSym].get(port);
    }

    [createPortDisplaySym](fbpPort) {
        if (!(this.port(fbpPort))) {
            const pd = new PortDisplay(this, fbpPort);
            this[fbpPort.input ? inputPortDisplaysSym : outputPortDisplaysSym].set(fbpPort, pd);
            this[fbpPort.input ? inputPortsDivSym : outputPortsDivSym].appendChild(pd.htmlElement);
        }
    }
    [removePortDisplaySym](fbpPort) {
        const pd = this.port(fbpPort);
        if(pd && !this.fbpProcess.getPort(fbpPort.name, fbpPort.direction)) {
            this[fbpPort.input ? inputPortDisplaysSym : outputPortDisplaysSym].delete(fbpPort);
            this[fbpPort.input ? inputPortsDivSym : outputPortsDivSym].removeChild(pd.htmlElement);
        }
    }

    updatePorts() {
        const inputSize = this.fbpProcess.inputSize;
        const outputSize = this.fbpProcess.outputSize;

        for(let i=0; i<inputSize; i++) {
            this[createPortDisplaySym](this.fbpProcess.getInputPort(i));
        }

        for(let i=0; i<outputSize; i++) {
            this[createPortDisplaySym](this.fbpProcess.getOutputPort(i));
        }

        if (inputSize < this.inputSize) {
            for(const p of this[inputPortDisplaysSym].keys())
                this[removePortDisplaySym](p);
        }

        if (outputSize < this.outputSize) {
            for(const p of this[outputPortDisplaysSym].keys())
                this[removePortDisplaySym](p);
        }
    }

    onChange(key, ...args) {
        switch(key) {
            case ChangeReason.PORT_CREATED: {
                const p = args[0];
                this[createPortDisplaySym](p);
                break;
            }
            case ChangeReason.PORT_DELETED: {
                const p = args[0];
                this[removePortDisplaySym](p);
                break;
            }
            case ChangeReason.PORT_CHANGED: {
                break;
            }
            case ChangeReason.SORT_PORTS:
            default:
                this.update();
                break;
        }
    }

    onDestroy() {
        this.titleElmt.blur();
        this.elmt.removeEventListener('dblclick', this[onDbClickSym]);
        if(this.elmt.parentElement)
            this.elmt.parentElement.removeChild(this.elmt);
    }

    // noinspection JSUnusedGlobalSymbols
    get inputSize() { return this[inputPortDisplaysSym].size; }
    // noinspection JSUnusedGlobalSymbols
    get outputSize() { return this[outputPortDisplaysSym].size; }

//######################################################################################################################
//#                                                    UI functions                                                    #
//######################################################################################################################

    move(delta) {
        this.position.add(delta);
        this.updatePosition();
    }

    validateMovement() {
        this.fbpProcess.setAttr('position', this.position.clone());
    }

    cancelMovement() {
        this.position.set(this.fbpProcess.getAttr('position', Vec2.ZERO));
        this.updatePosition();
    }

    updatePosition() {
        const position = this.position;
        this.elmt.style.left = position.x + 'px';
        this.elmt.style.top = position.y + 'px';
        this.updateConnections();
        //TODO hide element if not in visible rect ?
    }

    updateConnections() {
        const inputSize = this.inputSize;
        for(let i=0; i< inputSize; i++) {
            const port = this.fbpProcess.getInputPort(i);
            for(let conn of port.connections) {
                if(conn.display)
                    conn.display.update();
            }
        }
        const outputSize = this.outputSize;
        for(let i=0; i< outputSize; i++) {
            const port = this.fbpProcess.getOutputPort(i);
            for(let conn of port.connections) {
                if(conn.display)
                    conn.display.update();
            }
        }
    }

    updateColor() {
        const color = this.color;
        this.elmt.style.borderColor = color;
        this.titleElmt.style.backgroundColor = color;
        const rgba = hexToRGBA(color);
        this.titleElmt.style.color = luminance(rgba.r, rgba.g, rgba.b) > 0.5*255 ? '#000' : '#FFF';
    }

    update() {
        this.elmt.id = this.fbpProcess.id.toString(16);
        this.titleElmt.textContent = this.fbpProcess.name;
        this.elmt.toggleAttribute('hide-name', !this.visibleName);

        this.updateColor();
        this.cancelMovement(); // load position from process + update position of html elmt
        this.updatePorts();

        const opHTML = this.fbpProcess.getAttr('display_operation');
        while(this.operationDiv.childElementCount > 0 && this.operationDiv.firstElementChild !== opHTML)
            this.operationDiv.removeChild(this.operationDiv.firstElementChild);
        if(opHTML && this.operationDiv.firstElementChild !== opHTML)
            this.operationDiv.appendChild(opHTML);

        const detailsHTML = this.fbpProcess.getAttr('display_details');
        while(this.detailsDiv.childElementCount > 0 && this.detailsDiv.firstElementChild !== detailsHTML)
            this.detailsDiv.removeChild(this.detailsDiv.firstElementChild);
        if(detailsHTML && this.detailsDiv.firstElementChild !== detailsHTML)
            this.detailsDiv.appendChild(detailsHTML);
    }
    getRect() {
        const {width: width, height: height} = this.elmt.getBoundingClientRect();
        const scale = 1 / this.board.viewPort.zoomFactor;
        const scaledHalfW = width * scale / 2, scaledH = height * scale;
        const position = this.position;
        return new Rect(
            position.x - scaledHalfW, position.y,
            position.x + scaledHalfW, position.y + scaledH);
    }

    isInRect(rect) {
        return rect.contains(this.position) && rect.containsRect(this.getRect());
    }
}

export default ProcessDisplay;