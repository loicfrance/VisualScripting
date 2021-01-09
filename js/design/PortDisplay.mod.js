import {MouseButton} from "../../../jslib/utils/input.mod.js";
import {FbpPort} from "../FBP/fbp.mod.js";
import {FbpObjectChangeReason} from "../FBP/FbpObject.mod.js";
import {FbpPortChangeReason} from "../FBP/FbpPort.mod.js";
import {editorListener} from "./designUtils.mod.js";


const portTemplate = document.querySelector('#process-template').content.querySelector('.port');

const nameEditorListenerSym = Symbol("port name editor listener");
const valueEditorListenerSym = Symbol("port value editor listener");
const portSym = Symbol("FBP port");
const processSym = Symbol("design process");
const bulletListenerSym = Symbol("bullet mouse listener");

const portElmtSym = Symbol("port HTML element");
const bulletElmtSym = Symbol("bullet HTML element");
const nameElmtSym = Symbol("name HTML element");
const valueElmtSym = Symbol("value HTML element");

const ValueVisibility = {
    INVISIBLE: 0,
    VISIBLE: 1,
    AUTO: 2,
}

function getValueVisibility(value) {
    if(!!value === value)
        return value ? ValueVisibility.VISIBLE : ValueVisibility.INVISIBLE;
    else if(value.substr) {
        switch(value.toLowerCase()) {
            case "yes": case "visible":
                return ValueVisibility.VISIBLE;
            case "no": case "invisible": case "none":
                return ValueVisibility.INVISIBLE;
            case "auto":
                return ValueVisibility.AUTO;
            default: break;
        }
    } else if (Number.isInteger(value)) {
        if (value >= ValueVisibility.INVISIBLE && value <= ValueVisibility.AUTO)
            return value;
    }
    throw Error(`unknown visibility value ${value}`);
}

// noinspection JSUnusedGlobalSymbols
class PortDisplay {

//######################################################################################################################
//#                                                     ATTRIBUTES                                                     #
//######################################################################################################################

    [portElmtSym] = portTemplate.cloneNode(true);
    [nameElmtSym] = this[portElmtSym].querySelector('.name');
    [bulletElmtSym] = this[portElmtSym].querySelector('.bullet');
    [valueElmtSym] = this[portElmtSym].querySelector('.value');

    /** @type {FbpPassivePort|FbpPacketPort} */
    [portSym];
    /** @type {DesignProcess} */
    [processSym];

    // noinspection JSUnusedGlobalSymbols
    [valueEditorListenerSym] = editorListener.bind(this, {
        onStart: (evt)=> {
            const defValue = this.defaultValue.toString();
            if(this.isEditingValue() && evt.target.textContent !== defValue)
                evt.target.textContent = defValue;
        },
        onKeyDown: (evt)=> {
            switch(evt.code) {
                case 'Escape' : evt.target.textContent = this.value.toString(); //fall through 'enter' case
                case 'Enter' : evt.target.blur(); evt.preventDefault(); break;
            }
        },
        onInput: () => { this.process.updateConnections(); },
        onFocusLost: ()=> {
            const newValue = this.valueElement.textContent.length === 0 ? this.defaultValue
                : (this.dataType.parse ? this.dataType.parse(this.valueElement.textContent) : this.defaultValue);
            if(this.defaultValue !== newValue) {
                this.fbpPort.value = newValue;
            }
            this.process.updateConnections();
        }
    });

    [bulletListenerSym] = (function(evt) {
        if (MouseButton.getEventSource(evt) === MouseButton.LEFT) {
            evt.preventDefault();
            evt.stopPropagation();
            this.process.board.onPortBulletMouseEvent(this, evt);
        }
    }).bind(this);
//######################################################################################################################
//#                                                    CONSTRUCTOR                                                     #
//######################################################################################################################
    /**
     * @constructor
     * @param {ProcessDisplay} process
     * @param {FbpPort} port
     */
    constructor(process, port) {

        this[processSym] = process;
        this[portSym] = port;
        this.nameElement.addEventListener('dblclick', this[nameEditorListenerSym]);

        this.bulletElement.addEventListener('mousedown', this[bulletListenerSym]);
        this.bulletElement.addEventListener('mouseup', this[bulletListenerSym]);
        this.bulletElement.addEventListener('mouseenter', this[bulletListenerSym]);
        this.bulletElement.addEventListener('mouseout', this[bulletListenerSym]);

        if(this.passive) {
            this.htmlElement.setAttribute('passive', '');
            this.valueElement.addEventListener('focus', this[valueEditorListenerSym]);
        } else if (this.input) {
            //const valueElmt = this.valueElement;
            this.valueElement.textContent = "\u25b6";
            this.valueElement.addEventListener("click", ()=>
                this.fbpPort.onInputPacketReceived({})
            );
        } else {
            this.valueElement.parentNode.removeChild(this.valueElement);
            //this[valueElmtSym] = undefined;
        }
        this.fbpPort.display = this;
        this.update();
    }

//######################################################################################################################
//#                                                     ACCESSORS                                                      #
//######################################################################################################################

//__________________________________________________fbp port accessors__________________________________________________
//----------------------------------------------------------------------------------------------------------------------
    /** @type {FbpPort} */
    get fbpPort() {
        return this[portSym];
    }

    get name() { return this.fbpPort.name; }
    set name(value) {
        this.fbpPort.name = value;
    }

    get dataType() { return this.fbpPort.dataType; }
    set dataType(type) {
        this.fbpPort.dataType = type;
    }

    get value() {
        return (this.passive) ? this.fbpPort.value : undefined;
    }
    set value(value) {
        if(this.passive) {
            this.fbpPort.value = value;
            this.updateValueDisplay();
        } else throw Error("Cannot set value of active ports");
    }
    get defaultValue() { return (this.passive && this.input) ? this.fbpPort.defaultValue : undefined; }
    get passive() { return this.fbpPort.passive; }
    get active() { return this.fbpPort.active; }
    get input() { return this.fbpPort.input; }
    get output() { return this.fbpPort.output; }
    get passThrough() { return this.fbpPort.passThrough; }

//____________________________________________________view accessors____________________________________________________
//----------------------------------------------------------------------------------------------------------------------
    /** @type ProcessDisplay */
    get process() { return this[processSym]; }

    /** @type HTMLElement */
    get nameElement() { return this[nameElmtSym]; }
    /** @type HTMLElement */
    get htmlElement() { return this[portElmtSym]; }
    /** @type HTMLElement */
    get valueElement() { return this[valueElmtSym]; }
    /** @type HTMLElement */
    get bulletElement() { return this[bulletElmtSym]; }

    /** @type boolean */
    get visibleName() { return this.fbpPort.getAttr('visible_name', true); }

    /**
     * @param {boolean} value
     */
    set visibleName(value) { this.fbpPort.setAttr('visible_name', !!value); }

    /** @type {ValueVisibility} */
    get valueVisibility() {
        return getValueVisibility(this.fbpPort.getAttr('visible_value', ValueVisibility.INVISIBLE));
    }

    /** @param {string|boolean|ValueVisibility} value */
    set valueVisibility(value) {
        this.fbpPort.setAttr('visible_value', getValueVisibility(value));
    }

    get isValueVisible() {
        const visibility = this.valueVisibility;
        switch(visibility) {
            case ValueVisibility.INVISIBLE:
                return false;
            case ValueVisibility.AUTO:
                if (this.fbpPort.connections.length > 0 || this.fbpPort.passThrough)
                    return false;
                //fall to next case
            case ValueVisibility.VISIBLE:
                return this.passive
                    ? this.dataType.str
                    : (this.input && this.dataType.name === "void");
            default:
                throw Error(`Unknown visibility ${visibility}`);
        }
    }
    get isValueEditable() {
        return this.isValueVisible && (this.active ||
            this.input && this.fbpPort.connections.length === 0 && this.dataType.parse);
    }

    set selected(value) {
        this.htmlElement.toggleAttribute("selected", !!value);
    }

    get selected() {
        return this.htmlElement.hasAttribute("selected")
    }

    get position() {
        const r = this.bulletElement.getBoundingClientRect();
        return this.process.board.viewPort.pageToDesignCoordinatesTransform(r.x + r.width/2, r.y + r.height/2);
    }
//######################################################################################################################
//#                                                      METHODS                                                       #
//######################################################################################################################

    delete() {
        this[portSym].delete();
    }
    onDestroy() {
        this.nameElement.removeEventListener('dblclick', this[nameEditorListenerSym]);
        this.bulletElement.removeEventListener('mousedown', this[bulletListenerSym]);
        this.bulletElement.removeEventListener('mouseup', this[bulletListenerSym]);
        this.bulletElement.removeEventListener('mouseenter', this[bulletListenerSym]);
        this.bulletElement.removeEventListener('mouseout', this[bulletListenerSym]);
        if(this.passive)
            this.valueElement.removeEventListener('focus', this[valueEditorListenerSym]);

        //this.htmlElement.parentElement.removeChild(this.htmlElement);
    }
    // noinspection JSUnusedLocalSymbols
    onChange(reason, ...args) {
        switch(reason) {
            case FbpPortChangeReason.NAME:
                this.updateNameDisplay();
                break;
            case FbpPortChangeReason.DATA_TYPE:
                this.updateColor();
                break;
            case FbpPortChangeReason.CONNECTED:
            case FbpPortChangeReason.DISCONNECTED:
            case FbpPortChangeReason.VALUE:
                this.updateValueDisplay();
                break;
            case FbpObjectChangeReason.ATTRIBUTE:
                switch(args[0]) {
                    case 'visible_name': this.updateNameDisplay(); break;
                    case 'visible_value': this.updateValueDisplay(); break;
                    default: break;
                }
                break;
            case FbpPortChangeReason.PASS_THROUGH:
            default: break;
        }
    }

//_____________________________________________________view methods_____________________________________________________
//----------------------------------------------------------------------------------------------------------------------

    updateValueDisplay(updateConnections = true) {
        const visible = this.isValueVisible;
        if(!visible) {
            if(this.passive)
                this.valueElement.removeAttribute('contentEditable');
            this.htmlElement.removeAttribute('display-value');
        }
        else {
            const editable = this.isValueEditable;
            if(editable) {
                if(this.passive) {
                    this.valueElement.contentEditable = "true";
                    this.htmlElement.removeAttribute('display-value');
                } else
                    this.htmlElement.setAttribute('display-value', '');

            } else if(this.passive) {
                this.valueElement.removeAttribute('contentEditable');
                this.htmlElement.setAttribute('display-value', '');
            }
            if(this.passive && !this.isEditingValue()) {
                const value = this.value;
                const string = value === undefined ? '' : value.toString();
                if (string !== this.valueElement.textContent)
                    this.valueElement.textContent = string;
            }
        }
        if(updateConnections)
            this.process.updateConnections();
    }
    updateNameDisplay(updateConnections = true) {
        const visibleName = this.visibleName;
        if(visibleName)
            this.nameElement.textContent = this.name;
        this.htmlElement.toggleAttribute('hide-name', !visibleName);
        if(updateConnections)
            this.process.updateConnections();
    }
    updateColor() {
        this.bulletElement.style.borderColor = this.dataType.getAttr('color', '#F0F');
    }
    update() {
        this.updateNameDisplay(false);
        this.updateValueDisplay(false);
        this.updateColor();
        this.process.updateConnections();
    }
    isEditingValue() {
        return this.valueVisibility && document.activeElement === this.valueElement;
    }
}




export default PortDisplay;
export {
    PortDisplay,
};