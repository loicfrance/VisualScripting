import {DesignPort, PortValueVisibility} from "./DesignPort.mod.js";
import {FbpPassivePort, FbpPacketPort, FbpPortDirection as PORT_DIR} from "../FBP/FbpPort.mod.js";
import {typesTable} from "./DesignType.mod.js";
import DesignProcess from "./DesignProcess.mod.js";
import Vec2 from "../../../jsLibs_Modules/geometry2d/Vec2.mjs"
import {FbpPortDirection} from "../FBP/FbpPort.mod.js";

class UserConstantDesignProcess extends DesignProcess {
    /**
     * @constructor
     * @param board
     * @param {Object} parameters
     * @param {string} parameters.name
     * @param {DesignType|string} parameters.type
     * @param {*} parameters.baseValue
     * @param {Vec2} parameters.position
     * @param {string} parameters.color
     * @param {boolean} parameters.visibleName
     */
    constructor(board,
                {
                    name,
                    type = typesTable["any"],
                    baseValue,
                    position, color = '#800',
                    visibleName = true
                }) {
        super(board, name, position, color);
        this.visibleName = visibleName;
        this.createPort({name: 'value', type, output: true, passive: true,
            valueVisibility: PortValueVisibility.EDITABLE, visibleName: false, defaultValue: baseValue});
    }
}
class UserPacketLauncherDesignProcess extends DesignProcess {
    constructor(board,
                {
                    name,
                    type = typesTable["void"],
                    packet,
                    position, color = '#D30',
                    visibleName = true
                }) {
        super(board, name, position, color);
        this.visibleName = visibleName;
        this.packet = packet;
        this.createPort({name: 'value', type, output: true, passive: false, visibleName: false});
        this.button = document.createElement('button');
        this.button.onclick = () => { this.outputPort(0).send(this.packet); };
        this.operationDiv.appendChild(this.button);
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
    /** @type {Array<FbpType>} */
    out_types;
    /** @type {string|function(nb_in:number):string} */
    descriptor;
    /** @type {function(...*):(*|[])} */
    operation;

    /**
     * @param {Object} parameters
     * @param {string} parameters.name - name of the operator. USed to give a title to the process
     * @param {number} parameters.nb_in - default number of input. If left undefined (or NaN), takes the value of nb_in_max if not undefined or Infinity.
     * @param {number} parameters.nb_in_min - minimum number of inputs. If left undefined (or NaN), takes the value of nb_in
     * @param {number} parameters.nb_in_max - maximum number of inputs. If undefined but nb_in_min is defined, takes the value Infinity. If both are undefined, takes the value nb_in
     * @param {number} parameters.nb_out - number of outputs. Default is nb_out
     * @param {number} parameters.nb_out - number of outputs
     * @param {number} parameters.nb_out - number of outputs
     * @param {FbpType|FbpType[]} parameters.in_type - type(s) of the input ports
     * @param {FbpType|FbpType[]} parameters.out_type - type(s) of the output ports
     * @param {string|function(nb_in:number):string} parameters.descriptor - fills the center area of the process.
     * @param {function(*|...*):(*|[])} parameters.operation - function taking input values and outputting theresults
     */
    constructor({
                    name = "",
                    nb_in_min = NaN,
                    nb_in_max = NaN,
                    nb_in = NaN,
                    nb_out = NaN,
                    nb_out_min = NaN,
                    nb_out_max = NaN,
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
        this.nb_out = Math.round((!Number.isNaN(nb_out)) ? nb_out
                        : (Number.isFinite(nb_out_max)) ? nb_out_max
                        : (!Number.isNaN(nb_out_min)) ? nb_out_min
                        : 1);
        this.nb_out_max = Math.round(Number.isNaN(nb_out_max) ? Number.isNaN(nb_out_min) ? this.nb_out : Infinity : nb_out_max);
        this.nb_out_min = Math.round(Number.isNaN(nb_out_min) ? this.nb_out : nb_out_min);

        this.in_types = Array.isArray(in_type) ? in_type : [in_type];
        this.out_types = Array.isArray(out_type) ? out_type : [out_type];
        this.descriptor = descriptor;
        this.operation = operation;
    }
    getInputType(index) {
        return this.in_types[index >= this.in_types.length ? this.in_types.length-1 : index];
    }
    getOutputType(index) {
        return this.out_types[index >= this.out_types.length ? this.out_types.length-1 : index];
    }
    getDescription(nb_inputs) {
        return this.descriptor instanceof Function ? this.descriptor(nb_inputs) : this.descriptor;
    }
    operate(...inputs) {
        const result = this.operation(...inputs);
        return Array.isArray(result)? result : [result];
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

class OperationDesignProcess extends DesignProcess {
    operator;
    constructor(board, operator, position, color = "#080") {
        super(board, operator.name, position, color);
        this.operator = operator;

        this.createPort({name: 'activate', type: 'void', output: false, passive: false, visibleName: false});
        this.createPort({name: 'done'    , type: 'void', output: true , passive: false, visibleName: false});

        for(let i=0; i< operator.nb_in; i++) {
            this.createPort({name: 'in'+i, type: operator.getInputType(i), output: false, passive: true,
                valueVisibility: PortValueVisibility.HIDDEN, visibleName: false});
        }
        for(let i=0; i<operator.nb_out; i++) {
            this.createPort({name: 'out'+i, type: operator.getOutputType(i), output: true, passive: true,
                valueVisibility: PortValueVisibility.HIDDEN, visibleName: false});
        }
        this.visibleName = false;
        this.operationDiv.style.userSelect = 'none';
        this.operationDiv.style.fontFamily = 'Consolas, monospace';
        this.operationDiv.style.fontSize = 'calc(var(--process-title-font-size) * 2)';
    }
    update() {
        if(this.operator)
            this.operationDiv.textContent = this.operator.getDescription(this.inputSize-1);
        super.update();
    }
    handlePacket(port, value) {
        const inputs = this.inputDesignPorts.slice(1).map(p=>p.value);
        const outputs = this.operator.operate(...inputs);
        outputs.forEach((x,i)=>{this.outputPort(i+1).value = x});
        this.outputPort(0).send(value); //transfer the received packet
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
        this.visibleName = true;
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

class ScriptDesignProcess extends DesignProcess  {
    constructor(board, script, position) {
        super(board, "script", position, "#888");
        this.operationDiv.style.fontFamily = `Consolas, monospace`;
        this.operationDiv.style.fontSize = '15px';
        this.scriptElement = document.createElement('span');
        this.scriptElement.contentEditable = "true";
        this.operationDiv.appendChild(this.scriptElement);
        this.scriptElement.textContent = script;
        this.scriptElement.addEventListener('blur', ()=> { this.buildScript(); });
        this.scriptElement.addEventListener('input', ()=> this.updateConnections());
        this.buildScript();
    }
    addPort(port) {
        super.addPort(port);
        this.buildScript();
    }

    buildScript() {
        this.script = eval(`
            (${['process', ...this.inputDesignPorts.map(p=>p.name)].join(', ')})=> {
                ${this.scriptElement.textContent};
                return [${this.outputDesignPorts.map(p=>p.name).join(', ')}];
            }`);
    }
    handlePacket(port, value) {
        const result =this.script(this, ...this.inputDesignPorts.map(p=>p.value));
        this.outputDesignPorts.forEach((p, i) => {
            if (result[i] !== undefined) {
                p.value = result[i];
            }
        });
    }
}

export {
    UserConstantDesignProcess,
    UserPacketLauncherDesignProcess,
    Operator,
    OperationDesignProcess,
    //RouterDesignProcess,
    ScriptDesignProcess,
}