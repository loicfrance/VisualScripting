import {MouseButton} from "../../../jsLibs_Modules/utils/input.mjs";
import {FbpPort, FbpPassivePort, FbpPacketPort} from "../FBP/fbp.mod.js";
import {editorListener, validateVarName} from "./designUtils.mod.js";
import {DesignConnection} from "./DesignConnection.mod.js";
import {typesTable, DesignType} from "./DesignType.mod.js";
import {Vec2} from "../../../jsLibs_Modules/geometry2d/Vec2.mjs";


const portTemplate = document.querySelector('#process-template').content.querySelector('.port');

/**
 * @enum
 */
const PortValueVisibility = {
    HIDDEN: 0,
    VISIBLE: 1,
    EDITABLE: 2
};

const nameEditorListenerSym = Symbol("port name editor listener");
const valueEditorListenerSym = Symbol("port value editor listener");
const portSym = Symbol("FBP port");
const connectionsSym = Symbol("design connections");
const bulletListenerSym = Symbol("bullet mouse listener");

class DesignPort {

//######################################################################################################################
//#                                                     ATTRIBUTES                                                     #
//######################################################################################################################

    htmlElmt = portTemplate.cloneNode(true);
    nameElmt = this.htmlElmt.querySelector('.name');
    bulletElmt = this.htmlElmt.querySelector('.bullet');
    valueElmt = this.htmlElmt.querySelector('.value');

    /** @type {DesignConnection[]} */
    [connectionsSym] = [];

    /** @type {FbpPassivePort|FbpPacketPort} */
    [portSym];

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
            const newValue = this.valueElmt.textContent.length === 0 ? this.defaultValue
                : this.type.parse(this.valueElmt.textContent);
            if(this.defaultValue !== newValue) {
                this.value = newValue;
            }
            this.process.updateConnections();
        }
    });

    [bulletListenerSym] = (function(evt) {
        if (MouseButton.getEventSource(evt) === MouseButton.LEFT) {
            evt.preventDefault();
            this.process.board.onPortBulletMouseEvent(this, evt);
        }
    }).bind(this);
//######################################################################################################################
//#                                                    CONSTRUCTOR                                                     #
//######################################################################################################################
    /**
     * @constructor
     * @param {FbpPort} port
     * @param {Object} options
     * @param {PortValueVisibility} options.valueVisibility
     * @param {boolean} options.visibleName
     */
    constructor(port,
                {
                    valueVisibility = PortValueVisibility.HIDDEN,
                    visibleName = true
                } = {valueVisibility: PortValueVisibility.HIDDEN, visibleName: true}) {

        this[portSym] = port;
        this.nameElmt.textContent = this.name;
        this.nameElmt.addEventListener('dblclick', this[nameEditorListenerSym]);

        this.bulletElmt.style.borderColor = this.type.color;
        this.bulletElmt.addEventListener('mousedown', this[bulletListenerSym]);
        this.bulletElmt.addEventListener('mouseup', this[bulletListenerSym]);
        this.bulletElmt.addEventListener('mouseenter', this[bulletListenerSym]);
        this.bulletElmt.addEventListener('mouseout', this[bulletListenerSym]);

        if(this.passive) {
            this.htmlElmt.setAttribute('passive', '');
            this.valueElmt.textContent = this.defaultValue;
            this.valueElmt.addEventListener('focus', this[valueEditorListenerSym]);
            this.valueVisibility = valueVisibility;
        } else {
            this.valueElmt.parentNode.removeChild(this.valueElmt); // TODO maybe a button to fire the event ?
            this.valueElmt = undefined;
        }
        this.visibleName = visibleName;
        this.checkValidName();
        this.update();
    }

//######################################################################################################################
//#                                                     ACCESSORS                                                      #
//######################################################################################################################

//__________________________________________________fbp port accessors__________________________________________________
//----------------------------------------------------------------------------------------------------------------------

    get fbpPort() {
        return this[portSym];
    }
    get process() { return this[portSym].process; }

    get name() { return this[portSym].name; }
    set name(value) {
        this[portSym].name = value;
        this.nameElmt.textContent = value;
    }

    get type() { return this[portSym].type; }
    set type(type) {
        this[portSym].type = type;
        this.bulletElmt.style.borderColor = type.color;
    }

    get value() {
        return (this.passive) ? this[portSym].value : undefined;
    }
    set value(value) {
        if(this.passive) {
            this[portSym].value = value;
            this.updateValueDisplay();
        } else throw Error("Cannot only set value of passive ports");
    }
    get defaultValue() { return (this.passive) ? this[portSym].defaultValue : undefined; }
    get passive() { return this[portSym] instanceof FbpPassivePort; }
    get active() { return this[portSym] instanceof FbpPacketPort; }
    get input() { return this[portSym].input; }
    get output() { return this[portSym].output; }
    get running() { return this.active && this[portSym].running; }

    get connectionFull() {
        return this.passive && this.input && this[connectionsSym].length === 1;
    }

//____________________________________________________view accessors____________________________________________________
//----------------------------------------------------------------------------------------------------------------------

    set visibleName(value) {
        if(!value === this.visibleName) {
            this.htmlElmt.toggleAttribute('hide-name');
            this.process.updateConnections();
        }
    }
    updateValueDisplay() {
        if (this.passive && this.isValueVisible()) {
            const value = this.value;
            const string = value === undefined ? '' : value.toString();
            if (string !== this.valueElmt.textContent)
                this.valueElmt.textContent = string;
        }
    }

    get visibleName() {
        return !this.htmlElmt.hasAttribute('hide-name');
    }

    set valueVisibility(value) {
        if(this.valueElmt) switch (value) {
            case PortValueVisibility.HIDDEN :
                this.valueElmt.removeAttribute('contentEditable');
                this.htmlElmt.removeAttribute('display-value');
                break;
            case PortValueVisibility.VISIBLE :
                this.valueElmt.removeAttribute('contentEditable');
                this.htmlElmt.setAttribute('display-value', '');
                break;
            case PortValueVisibility.EDITABLE :
                this.valueElmt.contentEditable = true;
                this.htmlElmt.removeAttribute('display-value');
                break;
            default : throw new Error(`${value} is not a valid visibility`);
        }
        this.updateValueDisplay();
    }
    get valueVisibility() {
        return this.valueElmt ? this.valueElmt.isContentEditable ? PortValueVisibility.EDITABLE
            : this.htmlElmt.hasAttribute('display-value') ? PortValueVisibility.VISIBLE
            : PortValueVisibility.HIDDEN : PortValueVisibility.HIDDEN;
    }

    set selected(value) {
        this.htmlElmt.toggleAttribute("selected", !!value);
    }

    get selected() {
        return this.htmlElmt.hasAttribute("selected")
    }

    get position() {
        const r = this.bulletElmt.getBoundingClientRect();
        return this.process.board.pixelToDesignCoordinatesTransform(new Vec2(r.x + r.width/2, r.y + r.height/2));
    }
//######################################################################################################################
//#                                                      METHODS                                                       #
//######################################################################################################################

//___________________________________________________fbp port methods___________________________________________________
//----------------------------------------------------------------------------------------------------------------------

    /**
     * @param {DesignPort} other
     * @returns {boolean}
     */
    canConnect(other) {
        return this[portSym].canConnect(other[portSym]);
    }

    /**
     * @param {DesignPort} other
     */
    connect(other) {
        const connection = this[portSym].connect(other[portSym]);
        if(connection) {
            const designConn = new DesignConnection(this.process.board, connection)
            this[connectionsSym].push(designConn);
            other[connectionsSym].push(designConn);
        }
    }

    /**
     * @param {DesignPort} other
     */
    disconnect(other) {
        let i = this[connectionsSym].length;
        while(i--) {
            if(this[connectionsSym][i].connects(this, other)) {
                const c = this[connectionsSym][i];
                c.destroy();
            }
        }
    }
    disconnectAll() {
        let i = this[connectionsSym].length;
        while(i--)
            this[connectionsSym][i].destroy();
    }

    /**
     * @param {DesignPort} port
     * @return {DesignConnection}
     */
    getConnectionWith(port) {
        let i = this[connectionsSym].length;
        while(i--) {
            if (this[connectionsSym][i].connects(this, port))
                return this[connectionsSym][i];
        }
        return null;
    }

    start() {
        if(this.active) {
            this[portSym].start();
        }
    }

    stop() {
        if(this.active) {
            this[portSym].stop();
        }
    }
    send(packet) {
        if(this.active) {
            this[portSym].send(packet);
        }
    }

//_____________________________________________________view methods_____________________________________________________
//----------------------------------------------------------------------------------------------------------------------

    checkValidName() {
        if(!validateVarName(this.nameElmt.textContent))
            this.nameElmt.classList.add('invalid');
        else
            this.nameElmt.classList.remove('invalid');
    }
    updateConnections() {
        this[connectionsSym].forEach(c => c.update());
    }
    update() {
        if(this.passive) {
            if(this.isValueVisible() && !this.isEditingValue())
                this.valueElmt.textContent = this.value;
        }
        this.updateConnections();
    }
    isValueVisible() {
        return this.valueVisibility !== PortValueVisibility.HIDDEN;
    }
    isEditingValue() {
        return this.valueVisibility === PortValueVisibility.EDITABLE && document.activeElement === this.valueElmt;
    }
}




export {
    DesignPort,
    PortValueVisibility,

};
export default DesignPort;