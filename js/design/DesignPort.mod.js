import {MouseButton} from "../../../jsLibs_Modules/utils/input.mod.js";
import {FbpPassivePort, FbpPacketPort} from "../FBP/fbp.mod.js";
import {editorListener, validateVarName} from "./designUtils.mod.js";


const portTemplate = document.querySelector('#process-template').content.querySelector('.port');

/**
 * @enum
 */
const PortValueVisibility = {
    HIDDEN: 'hidden',
    VISIBLE: 'visible',
    EDITABLE: 'editable'
};

const nameEditorListenerSym = Symbol("port name editor listener");
const valueEditorListenerSym = Symbol("port value editor listener");
const portSym = Symbol("FBP port");
const processSym = Symbol("design process");
const bulletListenerSym = Symbol("bullet mouse listener");

const portElmtSym = Symbol("port HTML element");
const bulletElmtSym = Symbol("bullet HTML element");
const nameElmtSym = Symbol("name HTML element");
const valueElmtSym = Symbol("value HTML element");

class DesignPort {

//######################################################################################################################
//#                                                     ATTRIBUTES                                                     #
//######################################################################################################################

    [portElmtSym] = portTemplate.cloneNode(true);
    [nameElmtSym] = this[portElmtSym].querySelector('.name');
    [bulletElmtSym] = this[portElmtSym].querySelector('.bullet');
    [valueElmtSym] = this[portElmtSym].querySelector('.value');

    /** @type {DesignConnection[]} */

    /** @type {FbpPassivePort|FbpPacketPort} */
    [portSym];
    /** @type {DesignProcess} */
    [processSym];

    [nameEditorListenerSym] = editorListener.bind(this, {
        onKeyDown: (evt) => {
            switch(evt.code) {
                case 'Escape' : evt.target.textContent = this.name; //fall through 'enter' case
                case 'Enter' : evt.target.blur(); evt.preventDefault(); break;
            }
        },
        onInput: ()=> {
            this.checkValidName();
            this.process.updateConnections();
        },
        onFocusLost: (evt)=> {
            this.name = evt.target.textContent.trim();
            this.checkValidName();
            this.process.updateConnections();
        }
    });

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
                : this.type.parse(this.valueElement.textContent);
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
     * @param {DesignProcess} process
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
            this.valueElement.textContent = this.defaultValue;
            this.valueElement.addEventListener('focus', this[valueEditorListenerSym]);
        } else {
            this.valueElement.parentNode.removeChild(this.valueElement); // TODO maybe a button to fire the event ?
            this[valueElmtSym] = undefined;
        }
        this.update();
    }

//######################################################################################################################
//#                                                     ACCESSORS                                                      #
//######################################################################################################################

//__________________________________________________fbp port accessors__________________________________________________
//----------------------------------------------------------------------------------------------------------------------
    /** @type {FbpPacketPort|FbpPassivePort} */
    get fbpPort() {
        return this[portSym];
    }

    get name() { return this.fbpPort.name; }
    set name(value) {
        this.fbpPort.name = value;
    }

    get type() { return this.fbpPort.type; }
    set type(type) {
        this.fbpPort.type = type;
    }

    get value() {
        return (this.passive) ? this.fbpPort.value : undefined;
    }
    set value(value) {
        if(this.passive) {
            this.fbpPort.value = value;
            this.updateValueDisplay();
        } else throw Error("Cannot only set value of passive ports");
    }
    get defaultValue() { return (this.passive) ? this.fbpPort.defaultValue : undefined; }
    get passive() { return this.fbpPort.passive; }
    get active() { return !this.passive; }
    get input() { return this.fbpPort.input; }
    get output() { return this.fbpPort.output; }
    get running() { return this.active && this[portSym].running; }

//____________________________________________________view accessors____________________________________________________
//----------------------------------------------------------------------------------------------------------------------
    /** @type DesignProcess */
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
    set visibleName(value) {
        if(value) this.fbpPort.deleteInfo('hideName');
        else this.fbpPort.setInfo('hideName', true);
    }
    get visibleName() {
        return !this.fbpPort.getInfo('hideName');
    }
    /** @type PortValueVisibility */
    set valueVisibility(value) {
        if(!this.passive)
            throw Error("value visibility is only available for passive ports");
        switch(value) {
            case PortValueVisibility.VISIBLE : this.fbpPort.deleteInfo('valueVisibility'); break;
            case PortValueVisibility.HIDDEN : // idem as EDITABLE
            case PortValueVisibility.EDITABLE : this.fbpPort.setInfo('valueVisibility', value); break;
            default : throw Error("unknown value");
        }
    }
    get valueVisibility() {
        if(!this.passive)
            throw Error("value visibility is only available for passive ports");
        switch (this.fbpPort.getInfo('valueVisibility')) {
            case 'hidden' : return PortValueVisibility.HIDDEN;
            case 'editable' : return PortValueVisibility.EDITABLE;
            case 'visible' : case undefined : return PortValueVisibility.VISIBLE;
            default : throw Error("unknown value");
        }
    }
    updateValueDisplay() {
        if(this.passive) {
            const visibility = this.valueVisibility;
            switch (visibility) {
                case PortValueVisibility.HIDDEN :
                    this.valueElement.removeAttribute('contentEditable');
                    this.htmlElement.removeAttribute('display-value');
                    break;
                case PortValueVisibility.VISIBLE :
                    this.valueElement.removeAttribute('contentEditable');
                    this.htmlElement.setAttribute('display-value', '');
                    break;
                case PortValueVisibility.EDITABLE :
                    this.valueElement.contentEditable = true;
                    this.htmlElement.removeAttribute('display-value');
                    break;
                default : throw new Error(`${visibility} is not a valid visibility`);
            }
            if(!this.isEditingValue() && this.isValueVisible()) {
                const value = this.value;
                const string = value === undefined ? '' : value.toString();
                if (string !== this.valueElement.textContent)
                    this.valueElement.textContent = string;
            }
        }
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
    onFbpPortDeleted() {
        this.nameElement.removeEventListener('dblclick', this[nameEditorListenerSym]);
        this.bulletElement.removeEventListener('mousedown', this[bulletListenerSym]);
        this.bulletElement.removeEventListener('mouseup', this[bulletListenerSym]);
        this.bulletElement.removeEventListener('mouseenter', this[bulletListenerSym]);
        this.bulletElement.removeEventListener('mouseout', this[bulletListenerSym]);
        if(this.passive)
            this.valueElement.removeEventListener('focus', this[valueEditorListenerSym]);

        this.htmlElement.parentElement.removeChild(this.htmlElement);
    }

//_____________________________________________________view methods_____________________________________________________
//----------------------------------------------------------------------------------------------------------------------

    checkValidName() {
        if(!validateVarName(this.nameElement.textContent))
            this.nameElement.classList.add('invalid');
        else
            this.nameElement.classList.remove('invalid');
    }
    update() {
        this.nameElement.textContent = this.name;
        this.bulletElement.style.borderColor = this.type.color;
        this.updateValueDisplay();
        this.htmlElement.toggleAttribute('hide-name', !this.visibleName);
    }
    isValueVisible() {
        return this.valueVisibility !== PortValueVisibility.HIDDEN;
    }
    isEditingValue() {
        return this.valueVisibility === PortValueVisibility.EDITABLE && document.activeElement === this.valueElement;
    }
}




export {
    DesignPort,
    PortValueVisibility,

};
export default DesignPort;