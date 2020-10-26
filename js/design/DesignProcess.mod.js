import {Vec2, Rect} from "../../../jsLibs_Modules/geometry2d/geometry2d.mod.js";
import {FbpProcess, FbpPortDirection as PORT_DIR} from "../FBP/fbp.mod.js";
import {hexToRGBA, luminance} from "../../../jsLibs_Modules/utils/colors.mod.js";
import {editorListener, dragListener} from "./designUtils.mod.js";
import {MouseButton} from "../../../jsLibs_Modules/utils/input.mod.js";
import {DesignPort} from "./DesignPort.mod.js";

const processTemplate = document.querySelector('#process-template').content.firstElementChild;
// noinspection JSUnusedLocalSymbols
const detailsTemplate = document.querySelector('#process-details-template').content.firstElementChild;

const titleEditorListenerSym = Symbol("dblclick listener for title edition");

const fbpProcessSym = Symbol("FBP process");
const inputDesignPortsSym = Symbol("input design ports");
const outputDesignPortsSym = Symbol("output design ports");
const positionSym = Symbol("position");
const htmlElmtSym = Symbol("HTML element");
const titleElmtSym = Symbol("HTML title element");
const inputPortsDivSym = Symbol("input ports HTML container");
const outputPortsDivSym = Symbol("output ports HTML container");
const operationDivSym = Symbol("operation HTML div");
const detailsDivSym = Symbol("details HTML div");

class DesignProcess {
    [fbpProcessSym];
    /** @type {Map<fbpProcess, DesignProcess>} */
    [inputDesignPortsSym] = new Map();
    /** @type {Map<fbpProcess, DesignProcess>} */
    [outputDesignPortsSym] = new Map();
    // noinspection JSUnusedGlobalSymbols
    /** @type {Vec2} */
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
    [titleEditorListenerSym] = editorListener.bind(this, {
        onEditStart: () => { this.board.setSelection(this); },
        onKeyDown: (evt) => {
            switch(evt.code) {
                case 'Escape' : evt.target.textContent = this.fbpProcess.name; //fall through 'Escape' case
                case 'Enter' : evt.target.blur(); evt.preventDefault(); break;
            }
        },
        onInput: ()=> { this.update(); return true; },
        onFocusLost: (evt)=> {
            this.fbpProcess.name = evt.target.textContent.trim();
        }
    });

//######################################################################################################################
//#                                                    CONSTRUCTOR                                                     #
//######################################################################################################################

    /** @constructor
     * @param {DesignBoard} board
     * @param {FbpProcess} fbpProcess
     */
    constructor(board, fbpProcess) {
        this[fbpProcessSym] = fbpProcess;
        this.board = board;
        const startPos = Vec2.zero;
        this.titleElmt.addEventListener('dblclick', this[titleEditorListenerSym]);
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
    // noinspection JSUnusedGlobalSymbols
    /** @type {HTMLDivElement} */
    get inputPortsDiv() { return this[inputPortsDivSym]; }
    // noinspection JSUnusedGlobalSymbols
    /** @type {HTMLDivElement} */
    get outputPortsDiv() { return this[outputPortsDivSym]; }
    /** @type {HTMLDivElement} */
    get operationDiv() { return this[operationDivSym]; }
    // noinspection JSUnusedGlobalSymbols
    /** @type {HTMLDivElement} */
    get detailsDiv() { return this[detailsDivSym]; }

    set selected(value) {
        if(this.elmt.hasAttribute('selected') !== !!value)
            this.elmt.toggleAttribute('selected');
    }
    get selected() {
        return this.elmt.hasAttribute('selected');
    }
    get position() {
        return this[positionSym];
    }
    get color() { return this.fbpProcess.getInfo('color', '#FFF'); }
    set color(value) { this.fbpProcess.setInfo('color', value); }

    get visibleName() { return !this.fbpProcess.getInfo('hideName'); }
    set visibleName(value) {
        if(!!value) this.fbpProcess.deleteInfo('hideName');
        else this.fbpProcess.setInfo('hideName', true);
    }

//######################################################################################################################
//#                                                  PORTS MANAGEMENT                                                  #
//######################################################################################################################

    getDesignPort(fbpPort) {
        return this[fbpPort.input ? inputDesignPortsSym : outputDesignPortsSym].get(fbpPort);
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * @param {string} name - port name
     * @return {DesignPort}
     */
    inputPort(name) {
        const fbpPort = this.fbpProcess.getPort(name, PORT_DIR.IN);
        if(fbpPort)
            return this[inputDesignPortsSym].get(fbpPort);
        return undefined;
    }
    /**
     * @param {string} name - port name
     * @return {DesignPort}
     */
    outputPort(name) {
        const fbpPort = this.fbpProcess.getPort(name, PORT_DIR.OUT);
        if(fbpPort)
            return this[outputDesignPortsSym].get(fbpPort);
        return undefined;
    }
    /**
     * @param {string} name
     * @return {DesignPort}
     */
    port(name) {
        const fbpPort = this.fbpProcess.getPort(name);
        return this.getDesignPort(fbpPort);
    }

    /** @param {FbpPort} port */
    onFbpPortCreated(port) {
        if(this.getDesignPort(port))
            throw Error("port already created");
        const dp = new DesignPort(this, port);
        this[port.input ? inputDesignPortsSym : outputDesignPortsSym].set(port, dp);
        this[port.input ? inputPortsDivSym : outputPortsDivSym].appendChild(dp.htmlElement);
    }
    onFbpPortDeleted(port) {
        const dp = this.getDesignPort(port);
        this[port.input ? inputPortsDivSym : outputPortsDivSym].removeChild(dp.htmlElement);
        dp.onFbpPortDeleted();
    }
    onFbpPortChanged(port) {
        this.getDesignPort(port).update();
        this.updateConnections();
    }

    onFbpProcessDeleted(board) {
        this.titleElmt.blur();
        this.titleElmt.removeEventListener('dblclick', this[titleEditorListenerSym]);
        if(this.elmt.parentElement)
            this.elmt.parentElement.removeChild(this.elmt);

    }

    // noinspection JSUnusedGlobalSymbols
    get inputSize() { return this[inputDesignPortsSym].size; }
    // noinspection JSUnusedGlobalSymbols
    get outputSize() { return this[outputDesignPortsSym].size; }

//######################################################################################################################
//#                                                    UI functions                                                    #
//######################################################################################################################

    move(delta) {
        this.position.add(delta);
        this.updatePosition();
    }
    validateMovement() {
        this.fbpProcess.setInfo('position', this.position.clone());
    }
    cancelMovement() {
        this.position.set(this.fbpProcess.getInfo('position'));
    }

    updatePosition() {
        this.elmt.style.left = this.position.x + 'px';
        this.elmt.style.top = this.position.y + 'px';
        this.updateConnections();
        //TODO hide element if not in visible rect
    }

    updateConnections() {
        this.board.getDesignConnections(this).forEach(c=>c.update());
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
        if(this.titleElmt.contentEditable !== "true")
            this.titleElmt.textContent = this.fbpProcess.name;

        this.position.set(this.fbpProcess.getInfo('position') || Vec2.ZERO);
        this.elmt.toggleAttribute('hide-name', !this.visibleName);
        this.updateColor();
        this.updatePosition();

        const opHTML = this.fbpProcess.getInfo('operationHTML');
        while(this.operationDiv.childElementCount > 0 && this.operationDiv.firstElementChild !== opHTML)
            this.operationDiv.removeChild(this.operationDiv.firstElementChild);
        if(opHTML && this.operationDiv.firstElementChild !== opHTML)
            this.operationDiv.appendChild(opHTML);

        const detailsHTML = this.fbpProcess.getInfo('detailsHTML');
        while(this.detailsDiv.childElementCount > 0 && this.detailsDiv.firstElementChild !== detailsHTML)
            this.detailsDiv.removeChild(this.detailsDiv.firstElementChild);
        if(detailsHTML && this.detailsDiv.firstElementChild !== detailsHTML)
            this.detailsDiv.appendChild(detailsHTML);
    }
    getRect() {
        const {width: width, height: height} = this.elmt.getBoundingClientRect();
        const scale = 1 / this.board.viewPort.zoomFactor;
        const scaledHalfW = width * scale / 2, scaledH = height * scale;
        return new Rect(
            this.position.x - scaledHalfW, this.position.y,
            this.position.x + scaledHalfW, this.position.y + scaledH);
    }
    isInRect(rect) {
        return rect.contains(this.position) && rect.containsRect(this.getRect());
    }

    getOptionsArray() {
        const result = [
            { name: 'name', input_type: 'string', max: 30},
            { name: 'input ports', input_type: 'array', item: 'port'},
            { name: 'output ports', input_type: 'array', item: 'port'},
            { name: 'port', input_type: [
                {name: 'active', input_type: 'checkbox'},
                {name: 'display name', input_type: 'checkbox'},
                {name: 'display value', input_type: 'checkbox', condition: '!parent["active"]'},
                {name: 'editable value', input_type: 'checkbox', condition: 'parent["display value"]'},
                {name: 'name', input_type: 'string', max: 30},
                {name: 'type', input_type: 'string', max: 30},
            ]},
            { }

        ];
    }
    getOptionValue(optionPath) {

    }

//######################################################################################################################
//#                                                  Other functions                                                   #
//######################################################################################################################

    // noinspection JSUnusedGlobalSymbols
    handlePacket(port, value) {
        console.log(value);
    }
    // noinspection JSUnusedGlobalSymbols
    clearPorts() {
        let i = this[inputDesignPortsSym].length;
        while(i--) this[inputDesignPortsSym][i].disconnectAll();
        this[inputDesignPortsSym].splice(0);

        i = this[outputDesignPortsSym].length;
        while(i--) this[outputDesignPortsSym][i].disconnectAll();
        this[outputDesignPortsSym].splice(0);

        super.clearPorts();
    }

    delete() {
        this.fbpProcess.delete();
    }

}

export {
    DesignProcess,
}
export default DesignProcess;