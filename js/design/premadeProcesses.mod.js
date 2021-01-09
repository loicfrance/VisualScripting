import {FbpPassivePassThroughPort, FbpPortDirection} from "../FBP/fbp.mod.js";
import {FbpProcess} from "../FBP/FbpProcess.mod.js";
import {FbpCalculationProcess, Operator} from "../FBP/process-lib/FbpCalculationProcess.mod.js";
import {Visibility} from "./DesignPort.mod.js";
import DesignProcess from "./DesignProcess.mod.js";
//import {typesTable} from "./DesignType.mod.js";
import Vec2 from "../../../jslib/geometry2d/Vec2.mod.js"


class UserConstantProcess extends FbpProcess {
    /**
     * @constructor
     * @param {FbpSheet} fbpSheet
     * @param {Object} attributes
     * @param {string} attributes.name
     * @param {string} attributes.type
     * @param {*?} attributes.baseValue
     * @param {Vec2} attributes.position
     * @param {string?} attributes.color
     * @param {boolean?} attributes.hideName
     */
    constructor(fbpSheet, attributes) {
        if(!attributes.hasOwnProperty('color'))
            attributes.color = '#800';

        let {type, baseValue, ...attrs} = attributes;

        if(!type) type = "any";
        if (!baseValue) baseValue = fbpSheet.getType(type).defaultValue;

        super(fbpSheet, attrs);
        this.createPort({name: 'value', type: type, direction: FbpPortDirection.OUT, passive: true,
            valueVisibility: Visibility.EDITABLE, hideName: true, defaultValue: baseValue});
    }
    exportOperation() {
        let result = "";
        for(let i=0; i< this.inputSize; i++) {
            result += `const ${this.getOutputPort(i).name} = ${this.getOutputPort(i).value};\n`;
        }
    }
}

class UserPacketLauncherProcess extends FbpProcess {
    constructor(fbpSheet, attributes) {
        let {color, type, ...attrs} = attributes;
        if(!color)
            attributes.color = '#D30';

        if(type)
            type = "void";

        const button = document.createElement('button');
        button.textContent = "=>";
        attrs.operationHTML = button;
        super(fbpSheet, attrs);
        this.createPort({name: 'fire', type, direction: FbpPortDirection.OUT, passive: false, hideName: true});
        this.button = button;
        this.button.onclick = () => { this.getPort('fire', FbpPortDirection.OUT).send(this.packet); };
    }
    get packet() {
        return this.getAttr('packet');
    }
    set packet(value) {
        this.setAttr('packet', value);
    }
}

/**
 * TODO
 */
class DesignSheetPortsProcess extends DesignProcess {

    constructor(board, fbpProcess) {
        if (!(fbpProcess instanceof FbpCalculationProcess))
            throw Error(`can only accept FbpCalculationProcesses. ${fbpProcess} is not valid`);
        super(board, fbpProcess);
    }
}

//class Operator
class OperationDesignProcess extends DesignProcess {

    constructor(board, fbpProcess) {
        if (!(fbpProcess instanceof FbpCalculationProcess))
            throw Error(`can only accept FbpCalculationProcesses. ${fbpProcess} is not valid`);
        if (fbpProcess.getAttr("color") === undefined)
            fbpProcess.setAttr("color", "#080");
        if (fbpProcess.getAttr("hideName") === undefined)
            fbpProcess.setAttr("hideName", true);
        if (fbpProcess.getAttr("operationHTML") === undefined) {
            const operationHTML = document.createElement('span');
            operationHTML.style.userSelect = 'none';
            operationHTML.style.height = 'calc(var(--process-title-font-size) * 2)';
            operationHTML.style.lineHeight = 'calc(var(--process-title-font-size) * 2)';
            operationHTML.style.fontSize = 'calc(var(--process-title-font-size) * 2)';
            fbpProcess.setAttr("operationHTML", operationHTML);
        }
        let i = fbpProcess.inputSize;
        while(i--) {
            const port = fbpProcess.getInputPort(i);
            if (port.getAttr('valueVisibility') === undefined)
                port.setAttr('valueVisibility', Visibility.HIDDEN);
            if (port.getAttr('hideName') === undefined)
                port.setAttr('hideName', true);
        }
        i = fbpProcess.outputSize;
        while(i--) {
            const port = fbpProcess.getOutputPort(i);
            if (port.getAttr('valueVisibility') === undefined)
                port.setAttr('valueVisibility', Visibility.HIDDEN);
            if (port.getAttr('hideName') === undefined)
                port.setAttr('hideName', true);
        }
        super(board, fbpProcess);
    }
    onFbpPortCreated(port) {
        super.onFbpPortCreated(port);
        const opDisplay = this.fbpProcess.getAttr('operationHTML');
        opDisplay.textContent = this.fbpProcess.operator.getDescription(this.inputSize);
        this.fbpProcess.setAttr('operationHTML', opDisplay);
    }
    onFbpPortDeleted(port) {
        super.onFbpPortDeleted(port);
        const opDisplay = this.fbpProcess.getAttr('operationHTML');
        opDisplay.textContent = this.fbpProcess.operator.getDescription(this.inputSize);
        this.fbpProcess.setAttr('operationHTML', opDisplay);
    }
}
/*
class OperationProcess extends FbpProcess {
    constructor(fbpSheet, attributes) {
        if(!attributes.hasOwnProperty('color'))
            attributes.color = '#080';
        if(!attributes.hasOwnProperty('name'))
            attributes.name = attributes.operator.name;
        if(!attributes.hasOwnProperty('hideName'))
            attributes.hideName = true;
        attributes.operationHTML = document.createElement('span');
        attributes.operationHTML.style.userSelect = 'none';
        attributes.operationHTML.style.fontFamily = 'Consolas, monospace';
        attributes.operationHTML.style.fontSize = 'calc(var(--process-title-font-size) * 2)';

        super(fbpSheet, attributes);


        //this.createPort({name: 'activate', type: typesTable['void'], direction: FbpPortDirection.IN , passive: false, hideName: true});
        //this.createPort({name: 'done'    , type: typesTable['void'], direction: FbpPortDirection.OUT, passive: false, hideName: true});

        for(let i=0; i< this.operator.nb_in; i++) {
            this.createPort({name: 'in'+i, type: this.operator.getInputType(i),
                direction: FbpPortDirection.IN, passive: true,
                valueVisibility: PortValueVisibility.HIDDEN, hideName: true});
        }
        this.createPort({name: 'out', type: this.operator.getOutputType(),
            direction: FbpPortDirection.OUT, passive: true, passThrough: true,
            valueVisibility: PortValueVisibility.HIDDEN, hideName: true});
    }
    get operator() {
        return this.getAttr('operator');
    }
    onPortCreated(port) {
        super.onPortCreated(port);
        const opDisplay = this.getAttr('operationHTML');
        opDisplay.textContent = this.operator.getDescription(this.inputSize);
        this.setAttr('operationHTML', opDisplay);
    }
    onPortDeleted(port) {
        super.onPortDeleted(port);
        const opDisplay = this.getAttr('operationHTML');
        opDisplay.textContent = this.operator.getDescription(this.inputSize);
        this.setAttr('operationHTML', opDisplay);
    }

    getPassThroughValue(port) {
        if(port.name !== "out")
            throw new Error("Output port name ofr operator must be \"out\"");

        const inSize = this.inputSize;
        const inputs = new Array(inSize);
        for(let i=0; i<inSize; i++) {
            inputs[i] = this.getInputPort(i).value;
        }
        return this.operator.operate(...inputs);
    }
}
*/
const selectInSym = Symbol();
const selectOutSym = Symbol();
/*
class RouterDesignProcess extends DesignProcessV1 {
    constructor(board, nb_choices_in, nb_choices_out, choices_in_types, default_out_type, position, color = "#0CC") {
        if(nb_choices_in <= 0 || nb_choices_out <= 0)
            throw Error("cannot create a router without input and output ports");
        const [name, icon] = (nb_choices_in === 1 && nb_choices_out > 1) ? ["mux", '\u22fa']
                :    (nb_choices_in > 1 && nb_choices_out === 1) ? ["de-mux", "\u22f2"]
                :    (nb_choices_in > 1 && nb_choices_out > 1) ? ["router", '\u22fa\u22f2']
                :    ["buffer", '']; // 1 in, 1 out
        super(board, name, position, color);
        if(nb_choices_in > 1) {
            this.selectInPort = new DesignPort(this, {
                type: 'number', name:"sel_in", direction: FbpPortDirection.IN
            });
            this.addPort(this.selectInPort);
        }
        if(nb_choices_out > 1) {
            this.selectOutPort = new DesignPortV1(this, {
                type: 'number', name:"sel_out", direction: FbpPortDirection.IN
            });
            this.addPort(this.selectOutPort);
        }
        choices_in_types = Array.isArray(choices_in_types) ? choices_in_types : [choices_in_types];
        for(let i=0; i<nb_choices_in; i++) {
            const type = choices_in_types[i >= choices_in_types.length ? choices_in_types.length-1 : i];
            this.addPort(new DesignPortV1(this, {
                type: type, name:"in"+i, direction: FbpPortDirection.IN
            }));
        }
        for(let i=0; i<nb_choices_out; i++) {
            this.addPort(new DesignPortV1(this, {
                type: default_out_type, name:"out"+i, direction: FbpPortDirection.OUT
            }));
        }
        this.hideName = false;
        this.operationDiv.style.userSelect = 'none';
        this.operationDiv.style.fontFamily = 'Consolas, monospace';
        this.operationDiv.style.fontWeight = 'bold';
        this.operationDiv.textContent = icon;
        this[selectInSym] = 0;
        this[selectOutSym] = 0;
    }

    handlePacket(port, value) {
        if(this.selectInPort) {
            const firstIn = this.selectOutPort !== undefined ? 2 : 1;
            if(port === this.selectOutPort) {
                if(value !== this[selectOutSym]) {
                    this.outputPorts[this[selectOutSym]].reset();
                    this[selectOutSym] = value;
                    this.outputPorts[value].value = this.inputPorts[this[selectInSym]+firstIn].value;
                }
            } else if(port === this.selectInPort) {
                if(value !== this[selectInSym]) {
                    this[selectInSym] = value;
                    this.outputPorts[this[selectOutSym]].value = this.inputPorts[this[selectInSym]+firstIn].value;
                }
            } else if(port === this.selectInPort[this[selectInSym]+firstIn]) {
                this.outputPorts[this[selectOutSym]].value = this.inputPorts[this[selectInSym]+firstIn].value;
            }
        }
    }
}
*/

class ScriptProcess extends FbpProcess  {
    constructor(fbpSheet, attributes) {

        if(!attributes.hasOwnProperty('color'))
            attributes.color = '#888';
        if(!attributes.hasOwnProperty('name'))
            attributes.name = 'script';

        attributes.detailsHTML = document.createElement('span');
        attributes.detailsHTML.style.fontFamily = `Consolas, monospace`;
        attributes.detailsHTML.style.fontSize = '15px';
        attributes.detailsHTML.contentEditable = "true";
        attributes.detailsHTML.textContent = attributes.script;

        super(fbpSheet, attributes);
        attributes.detailsHTML.addEventListener('blur', ()=> { this.buildScript(); });
        //attributes.detailsHTML.addEventListener('input', ()=> this.updateConnections());
        this.buildScript();
    }
    get scriptHTML() {
        return this.getAttr('detailsHTML');
    }
    onPortCreated(port) {
        super.onPortCreated(port);
    }
    onPortDeleted(port) {
        super.onPortDeleted(port);
    }

    buildScript() {
        this.script = eval(`
            (process, port, packet)=> {
                ${this.scriptHTML.textContent};
            }`);
    }
    handlePacket(port, value) {
        const result = this.script(this, port, value);
    }
}

export {
    UserConstantProcess,
    UserPacketLauncherProcess,
    OperationDesignProcess,
    //RouterDesignProcess,
    ScriptProcess,
}