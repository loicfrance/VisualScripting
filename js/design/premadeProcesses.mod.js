import {FbpPassivePassThroughPort, FbpPortDirection} from "../FBP/fbp.mod.js";
import {FbpProcess} from "../FBP/FbpProcess.mod.js";
import {PortValueVisibility} from "./DesignPort.mod.js";
import {typesTable} from "./DesignType.mod.js";
import Vec2 from "../../../jsLibs_Modules/geometry2d/Vec2.mod.js"


class UserConstantProcess extends FbpProcess {
    /**
     * @constructor
     * @param {FbpSheet} fbpSheet
     * @param {Object} attributes
     * @param {string} attributes.name
     * @param {DesignType|string} attributes.type
     * @param {*?} attributes.baseValue
     * @param {Vec2} attributes.position
     * @param {string?} attributes.color
     * @param {boolean?} attributes.hideName
     */
    constructor(fbpSheet, attributes) {
        if(!attributes.hasOwnProperty('color'))
            attributes.color = '#800';

        let type, baseValue;

        if(attributes.hasOwnProperty('type')) {
            type = attributes.type.substr ? typesTable[attributes.type] : attributes.type;
            delete (attributes.type);
        } else type = typesTable["any"];

        if(attributes.hasOwnProperty('baseValue')) {
            baseValue = attributes.baseValue;
            delete (attributes.baseValue);
        } else baseValue = type.defaultValue;

        super(fbpSheet, attributes);
        this.createPort({name: 'value', type: type, direction: FbpPortDirection.OUT, passive: true,
            valueVisibility: PortValueVisibility.EDITABLE, hideName: true, defaultValue: baseValue});
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
        if(!attributes.hasOwnProperty('color'))
            attributes.color = '#D30';

        let type;

        if(attributes.hasOwnProperty('type')) {
            type = attributes.type.substr ? typesTable[attributes.type] : attributes.type;
            delete (attributes.type);
        } else type = typesTable["void"];

        const button = document.createElement('button');
        button.textContent = "=>";
        attributes.operationHTML = button;
        super(fbpSheet, attributes);
        this.createPort({name: 'fire', type, direction: FbpPortDirection.OUT, passive: false, hideName: true});
        this.button = button;
        this.button.onclick = () => { this.getPort('fire', FbpPortDirection.OUT).send(this.packet); };
    }
    get packet() {
        return this.getInfo('packet');
    }
    set packet(value) {
        this.setInfo('packet', value);
    }
}

class Operator {
    /** @type {string} */
    name;
    /** @type {number} */
    nb_in;
    /** @type {number} */
    nb_in_min;
    /** @type {number} */
    nb_in_max;
    /** @type {number} */
    nb_out;
    /** @type {Array<FbpType>} */
    in_types;
    /** @type {FbpType} */
    out_type;
    /** @type {string|function(nb_in:number):string} */
    descriptor;
    /** @type {function(*|...*):(*|[])} */
    operation;

    /**
     * @param {Object} parameters
     * @param {string} parameters.name - name of the operator. Used to give a title to the process
     * @param {number} parameters.nb_in - default number of input. If left undefined (or NaN), takes the value of nb_in_max if not undefined or Infinity.
     * @param {number} parameters.nb_in_min - minimum number of inputs. If left undefined (or NaN), takes the value of nb_in
     * @param {number} parameters.nb_in_max - maximum number of inputs. If undefined but nb_in_min is defined, takes the value Infinity. If both are undefined, takes the value nb_in
     * @param {FbpType|FbpType[]} parameters.in_type - type(s) of the input ports
     * @param {FbpType} parameters.out_type - type of the output port
     * @param {string|function(nb_in:number):string} parameters.descriptor - fills the center area of the process.
     * @param {function(*|...*):(*)} parameters.operation - function taking input values and outputting theresults
     */
    constructor({
                    name = "",
                    nb_in_min = NaN,
                    nb_in_max = NaN,
                    nb_in = NaN,
                    in_type = typesTable['number'],
                    out_type = typesTable['number'],
                    descriptor = undefined,
                    operation = undefined
                }) {
        this.name = name;
        if(Number.isNaN(nb_in)) {
            if(Number.isNaN(nb_in_min) && Number.isNaN(nb_in_max))
                throw new Error("missing input size");
            this.nb_in = Math.round(Number.isFinite(nb_in_max) ? nb_in_max : nb_in_min);
        } else
            this.nb_in = nb_in;
        this.nb_in_min = Math.round(Number.isNaN(nb_in_min) ? nb_in : nb_in_min);
        this.nb_in_max = Math.round(Number.isNaN(nb_in_max) ? Number.isNaN(nb_in_min) ? nb_in : Infinity : nb_in_max);
        if(this.nb_in < this.nb_in_min || this.nb_in > this.nb_in_max) {
            throw new Error("input size out of range");
        }
        this.in_types = Array.isArray(in_type) ? in_type : [in_type];
        this.out_type = out_type;
        this.descriptor = descriptor;
        this.operation = operation;
    }
    getInputType(index) {
        return this.in_types[index >= this.in_types.length ? this.in_types.length-1 : index];
    }
    getOutputType() {
        return this.out_type;
    }
    getDescription(nb_inputs) {
        return this.descriptor instanceof Function ? this.descriptor(nb_inputs) : this.descriptor;
    }
    operate(...inputs) {
        return this.operation(...inputs);
    }
    static SUM = new Operator({name: "sum", nb_in_min: 2, descriptor: (n)=> n===2 ? '+' : '\u2211',
                                operation: (...x)=> x.reduce((r,v)=>r+v)});
    static SUBTRACTION = new Operator({name: "subtraction", nb_in_min: 1, nb_in_max: 2, descriptor: '-',
                                operation: (a,b=NaN)=> Number.isNaN(b) ? -a : a-b});
    static PRODUCT = new Operator({name: "product", nb_in_min: 2, descriptor: (n)=> n===2 ? '\u00D7' : '\u220f',
                                operation: (...x)=> x.reduce((r,v)=>r*v)});
    static DIVISION = new Operator({name: "division", nb_in: 2, descriptor: '\u00f7', operation: (a,b)=>a/b});
    static MODULO = new Operator({name: "modulo", nb_in: 2, descriptor: '%', operation: (a,b)=>a%b});
    static SQRT = new Operator({name: "square root", nb_in: 1, descriptor: '\u221a', operation: Math.sqrt});
    static MAX = new Operator({name: 'maximum', nb_in_min: 2, descriptor: 'max', operation: Math.max});
    static MIN = new Operator({name: 'minimum', nb_in_min: 2, descriptor: 'min', operation: Math.min});
    static LEFT_SHIFT = new Operator({name: "bitwise left shift", nb_in: 2, descriptor: '<<', operation: (a,b)=>a<<b});
    static RIGHT_SHIFT = new Operator({name: "bitwise right shift", nb_in: 2, descriptor: '>>', operation: (a,b)=>a>>b});
    static BITWISE_NOT = new Operator({name: "bitwise NOT", nb_in: 1, descriptor: '~', operation: (x)=>~x});
    static BITWISE_AND = new Operator({name: "bitwise AND", nb_in_min : 2, descriptor: '\u22C0',
                                operation: (...x)=> x.reduce((r,v)=>r&v)});
    static BITWISE_OR = new Operator({name: "bitwise OR", nb_in_min: 2, descriptor: '\u22C1',
                                operation: (...x)=> x.reduce((r,v)=>r|v)});
    static BITWISE_XOR = new Operator({name: "bitwise EXCLUSIVE OR (XOR)", nb_in_min: 2, descriptor: '\u2295',
                                operation: (...x)=> x.reduce((r,v)=>r^v)});
    static LOWER = new Operator({name: "lower than", nb_in: 2, descriptor : '<', operation: (a,b)=>a<b});
    static GREATER = new Operator({name: "greater than", nb_in: 2, descriptor : '>', operation: (a,b)=>a>b});
    static LOWER_EQUAL = new Operator({name: "lower or equal than", nb_in: 2, descriptor : '\u2264', operation: (a,b)=>a<=b});
    static GREATER_EQUAL = new Operator({name: "greater or equal than", nb_in: 2, descriptor : '\u2265', operation: (a,b)=>a>=b});
    static EQUAL = new Operator({name: "equal", nb_in: 2, descriptor : '=', operation: (a,b)=>a===b});
    static DIFFERENT = new Operator({name: "different", nb_in: 2, descriptor : '\u2260', operation: (a,b)=>a!==b});
    static LOGIC_AND = new Operator({name: "logical AND", nb_in_min: 2, descriptor : 'AND',
                                operation: (...x)=> x.reduce((r,v)=>r&&v)});
    static LOGIC_OR = new Operator({name: "logical OR", nb_in_min: 2, descriptor : 'OR',
                                operation: (...x)=> x.reduce((r,v)=>r||v)});
    static LOGIC_NOT = new Operator({name: "logical OR", nb_in: 1, descriptor : 'NOT', operation: x=>!x});
}

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
        return this.getInfo('operator');
    }
    onPortCreated(port) {
        super.onPortCreated(port);
        const opDisplay = this.getInfo('operationHTML');
        opDisplay.textContent = this.operator.getDescription(this.inputSize);
        this.setInfo('operationHTML', opDisplay);
    }
    onPortDeleted(port) {
        super.onPortDeleted(port);
        const opDisplay = this.getInfo('operationHTML');
        opDisplay.textContent = this.operator.getDescription(this.inputSize);
        this.setInfo('operationHTML', opDisplay);
    }

    /**
     * @param {FbpPassivePassThroughPort} port
     */
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
        return this.getInfo('detailsHTML');
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
    Operator,
    OperationProcess,
    //RouterDesignProcess,
    ScriptProcess,
}