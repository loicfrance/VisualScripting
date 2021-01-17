import {getOperationsDisplay, setOperation, getOperationResult} from "./_base.js";

const module_name = "math.op2";
const attr_op = module_name+".operation";
const attr_in1_type = module_name+".in1_type";
const attr_in2_type = module_name+".in2_type";

const operations = {
    plus    : {display: "+", f: (a,b)=>a+b},
    minus   : {display: "-", f: (a,b)=>a-b},
    multiply: {display: "\u00d7", f: (a,b)=> a * b},
    divide  : {display: "\u00f7", f: (a,b)=> a / b},
    modulo  : {display: "mod", f: (a,b)=> a % b},
    max     : {display: "max", f: Math.max},
    min     : {display: "min", f: Math.min},
}
const types = {
    int: "int",
    float: "float"
};

function getParameters() {
    return [{
        key:"op", name: "operation",
        type: "select", values: getOperationsDisplay(operations),
        default: "plus"
    }, {
        key:"in1_type", name: "input type 1",
        type: "select", values: types,
        default: "float"
    }, {
        key:"in2_type", name: "input type 2",
        type: "select", values: types,
        default: "float"
    }];
}

/**
 * @param {string} op
 * @param {string} in1_type
 * @param {string} in2_type
 * @param {FbpEnvironment} env
 * @return {string|null}
 */
function checkParameters({op, in1_type, in2_type}, env) {
    if (!(op.substr && operations.hasOwnProperty(op)))
        return `unknown operation ${op}`;
    if (!(in1_type.substr && types.hasOwnProperty(in1_type)))
        return `incompatible type ${in1_type}`;
    if (!(in2_type.substr && types.hasOwnProperty(in2_type)))
        return `incompatible type ${in2_type}`;
    return null;
}

/**
 * @param {string} op
 * @param {string} in1_type
 * @param {string} in2_type
 */

function onCreate({op="plus", in1_type, in2_type}) {

    const error = checkParameters({op, in1_type, in2_type}, this.env);
    if(error)
        throw Error(error);

    const out_type = (in1_type === "float" || in2_type === "float") ? "float" : "int"

    const ports_common = {visible_name: false};

    this.createPorts(
        {...ports_common, direction: "in", dataType: in1_type, name: "a", visible_value: "auto"},
        {...ports_common, direction: "in", dataType: in2_type, name: "b", visible_value: "auto"},
        {...ports_common, direction: "out", dataType: out_type, name: "out", passThrough: true}
    );
    this.setAttr(attr_op, op);
    this.setAttr(attr_in1_type, in1_type);
    this.setAttr(attr_in2_type, in2_type);
    setOperation(this, operations, op);
}

function getPassThroughValue(port) {
    return getOperationResult(this, "a", "b");
}

function exportJSON() {
    return {
        op: this.getAttr(attr_op),
        in1_type: this.getAttr(attr_in1_type),
        in2_type: this.getAttr(attr_in2_type),
    };
}

export {
    onCreate,
    getPassThroughValue,
    getParameters,
    checkParameters,
    exportJSON
}