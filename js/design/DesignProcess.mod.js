import {Vec2, Rect} from "../../../jsLibs_Modules/geometry2d/geometry2d.mod.js";
import {FbpPacketPort, FbpPassivePort, FbpProcess, FbpPortDirection as PORT_DIR} from "../FBP/fbp.mod.js";
import {hexToRGBA, luminance} from "../../../jsLibs_Modules/utils/colors.mod.js";
import {editorListener, validateVarName, dragListener} from "./designUtils.mod.js";
import {MouseButton} from "../../../jsLibs_Modules/utils/input.mod.js";
import {DesignPort, PortValueVisibility} from "./DesignPort.mod.js";
import {DesignType, typesTable} from "./DesignType.mod.js";

const processTemplate = document.querySelector('#process-template').content.firstElementChild;
const detailsTemplate = document.querySelector('#process-details-template').content.firstElementChild;

class DesignProcess extends FbpProcess {
    /** @type {DesignPort[]} */
    inputDesignPorts = [];
    /** @type {DesignPort[]} */
    outputDesignPorts = [];
    /** @type {Vec2} */
    position = Vec2.zero;
    // noinspection JSValidateTypes
    /** @type {HTMLElement} */
    elmt = processTemplate.cloneNode(true);
    /** @type {HTMLElement} */
    titleElmt = this.elmt.querySelector(".title");
    /** @type {HTMLDivElement} */
    inputPortsDiv = this.elmt.querySelector(".ports.input");
    /** @type {HTMLDivElement} */
    outputPortsDiv = this.elmt.querySelector(".ports.output");
    /** @type {HTMLDivElement} */
    operationDiv = this.elmt.querySelector(".operation");
    /** @type {HTMLDivElement} */
    detailsDiv = this.elmt.querySelector(".details");

    /** @constructor
     * @param {DesignBoard} board
     * @param name
     * @param position
     * @param color
     */
    constructor(board, name, position, color = "#FFF") {
        super(name);
        this.board = board;
        this.position.set(position.clone().mul(0.1).roundedVec().mul(10));

        let selectedBefore = false;
        this.elmt.addEventListener('mousedown', dragListener.bind(this, {
            buttonMask: MouseButton.LEFT, cursor: 'grabbing',
            onStart: (evt)=> {
                if(evt.target.isContentEditable || evt.defaultPrevented) return false;
                evt.preventDefault();
                selectedBefore = this.selected;
                if(!selectedBefore) this.board.onObjectClick(this, evt);
            },
            onMove: (evt, pos, delta) => {
                delta.mul(1/this.board.zoom);
                this.move(delta);
                this.board.onProcessDrag(this, evt, delta);
            },
            onStop: (evt)=> {
                evt.stopPropagation();
                this.position.set(this.position.mul(0.1).roundedVec().mul(10));
                if(selectedBefore) this.board.onObjectClick(this, evt);
            }
        }));


        this.titleElmt.addEventListener('dblclick', editorListener.bind(this, {
            onEditStart: () => { this.board.setSelection(this); },
            onKeyDown: (evt) => {
                switch(evt.code) {
                    case 'Escape' : evt.target.textContent = this.name; //fall through 'Escape' case
                    case 'Enter' : evt.target.blur(); evt.preventDefault(); break;
                }
            },
            onInput: (evt)=> { this.update(); return true; },
            onFocusLost: (evt)=> {
                this.name = evt.target.textContent.trim();
                this.update();
            }
        }));
        this.selected = false;
        this.color = color;
        this.update();
        this.updatePosition();
    }

//######################################################################################################################
//#                                                     ACCESSORS                                                      #
//######################################################################################################################

    set selected(value) {
        if(this.elmt.hasAttribute('selected') !== !!value)
            this.elmt.toggleAttribute('selected');
    }
    get selected() {
        return this.elmt.hasAttribute('selected');
    }
    set color(value) {
        this.elmt.style.borderColor = value;
        this.titleElmt.style.backgroundColor = value;
        const rgba = hexToRGBA(value);
        this.titleElmt.style.color = luminance(rgba.r, rgba.g, rgba.b) > 0.5*255 ? '#000' : '#FFF';
    }
    get color() {
        return this.elmt.style.borderColor;
    }
    set visibleName(value) {
        if(!!value !== this.visibleName) {
            this.elmt.toggleAttribute('hide-name');
            this.updateConnections();
        }
    }
    get visibleName() {
        return !this.elmt.hasAttribute('hide-name');
    }

//######################################################################################################################
//#                                                  PORTS MANAGEMENT                                                  #
//######################################################################################################################

    // noinspection JSCheckFunctionSignatures
    /**
     * @param {DesignPort} port
     */
    addPort(port) {
        super.addPort(port.fbpPort);
        if(port.output)
            this.outputDesignPorts.push(port);
        else this.inputDesignPorts.push(port);
        this.update();
    }
    // noinspection JSCheckFunctionSignatures
    /**
     * @param {DesignPort} port
     */
    removePort(port) {
        port.htmlElmt.parentElement.removeChild(port.htmlElmt);
        super.removePort(port.port);
        const list = port.output ? this.outputDesignPorts : this.inputDesignPorts;
        const idx = list.indexOf(port);
        if(idx >= 0)
            list.splice(idx, 1);
        this.update();
    }

    /**
     * @param {string|number} id - port name or index within input ports
     * @return {DesignPort}
     */
    inputPort(id) {
        if(id.substr) {
            let i = this.inputDesignPorts.length;
            while (i--) {
                if (this.inputDesignPorts[i].name === id)
                    return this.inputDesignPorts[i];
            }
            return undefined;
        } else if(id < this.inputDesignPorts.length)
            return this.inputDesignPorts[id];
        else
            return undefined;
    }
    get inputSize() {
        return this.inputDesignPorts.length;
    }
    get outputSize() {
        return this.outputDesignPorts.length;
    }
    /**
     * @param {string|number} id - port name or index within input ports
     * @return {DesignPort}
     */
    outputPort(id) {
        if(id.substr) {
            let i = this.outputDesignPorts.length;
            while (i--) {
                if (this.outputDesignPorts[i].name === id)
                    return this.outputDesignPorts[i];
            }
            return undefined;
        } else if(id < this.outputDesignPorts.length)
            return this.outputDesignPorts[id];
        else
            return undefined;
    }

    /**
     * @param {string} name
     * @return {DesignPort}
     */
    port(name) {
        return this.inputPort(name) || this.outputPort(name);
    }

    /**
     * @param {Object} parameters
     * @param {string} parameters.name
     * @param {boolean} parameters.passive
     * @param {boolean} parameters.output
     * @param {DesignType|string} parameters.type
     * @param {PortValueVisibility} parameters.valueVisibility
     * @param {boolean} parameters.visibleName
     * @param {*} parameters.defaultValue
     */
    createPort({
                   name,
                   passive = true,
                   output = false,
                   type = typesTable['any'],
                   valueVisibility = PortValueVisibility.HIDDEN,
                   visibleName = true,
                   defaultValue
               }) {
        if(this.port(name))
            throw Error("Port name already used");
        if(type.substr) {
            if(typesTable[type]) type = typesTable[type];
            else {
                type = new DesignType({name: type});
                typesTable.addType(type);
            }
        }
        if(defaultValue === undefined) {
            defaultValue = type.defaultValue;
        }
        const fbpPort = passive ?
            new FbpPassivePort(this, type, name, output ? PORT_DIR.OUT : PORT_DIR.IN, defaultValue)
            : new FbpPacketPort(this, type, name, output ? PORT_DIR.OUT : PORT_DIR.IN);
        const designPort = new DesignPort(fbpPort, {valueVisibility, visibleName});
        this.addPort(designPort);
        return designPort;
    }

//######################################################################################################################
//#                                                    UI functions                                                    #
//######################################################################################################################

    move(delta) {
        this.position.add(delta);
        this.updatePosition();
    }

    updatePosition() {
        this.elmt.style.left = Math.floor(this.position.x/10)*10 + 'px';
        this.elmt.style.top = Math.floor(this.position.y/10)*10 + 'px';
        this.updateConnections();
        //TODO hide element if not in visible rect
    }

    updateConnections() {
        this.inputDesignPorts.forEach(p=> {p.update()});
        this.outputDesignPorts.forEach(p=> {p.update()});
    }
    update() {
        if(this.titleElmt.contentEditable !== "true")
            this.titleElmt.textContent = this.name;
        this.inputDesignPorts.map(p=> p.htmlElmt).forEach(this.inputPortsDiv.appendChild.bind(this.inputPortsDiv));
        this.outputDesignPorts.map(p=> p.htmlElmt).forEach(this.outputPortsDiv.appendChild.bind(this.outputPortsDiv));
        this.updateConnections();
    }
    getRect() {
        const {width: width, height: height} = this.elmt.getBoundingClientRect();
        const scale = 1 / this.board.zoom;
        const scaledHalfW = width * scale / 2, scaledH = height * scale;
        return new Rect(
            this.position.x - scaledHalfW, this.position.y,
            this.position.x + scaledHalfW, this.position.y + scaledH);
    }
    isInRect(rect) {
        return rect.contains(this.position) && rect.containsRect(this.getRect());
    }

//######################################################################################################################
//#                                                  Other functions                                                   #
//######################################################################################################################

    handlePacket(port, value) {
        console.log(value);
    }

}

export {
    DesignProcess,
}
export default DesignProcess;