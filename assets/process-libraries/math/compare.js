import {getOperationsDisplay, setOperation, getOperationResult} from "./_base.js";

const module_name = "math.compare";
const attr_op = module_name+".operation";
const attr_in1Type = module_name+".in1_type";
const attr_in2Type = module_name+".in2_type";

const operations = {
    eq: {display: "="     , f: (a,b)=> a === b},
    ne: {display: "\u2260", f: (a,b)=> a !== b},
    lt: {display: "<"     , f: (a,b)=> a < b},
    gt: {display: ">"     , f: (a,b)=> a > b},
    le: {display: "\u2264", f: (a,b)=> a <= b},
    ge: {display: "\u2265", f: (a,b)=> a >= b},
}
function getParameters({op}) {

    return [{
        key: "op", name: "operation",
        type: "select", values: getOperationsDisplay(operations),
        default: "eq"
    }, {
        key: "in1_type", name:"input type 1",
        type: "string"
    }, {
        key: "in2_type", name:"input type 2",
        type: "string"
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

    if (!(operations.hasOwnProperty(op)))
        return `unknown operation: ${op}`;
    if (!env.getType(in1_type))
        return `unknown type ${in1_type}`;
    if (!env.getType(in2_type))
        return `unknown type ${in2_type}`;
    return null;
}

/**
 * @param {string} op
 * @param {string} in1_type
 * @param {string} in2_type
 */
function onCreate({op="and", in1_type="float", in2_type="float"}) {

    const error = checkParameters({op, in1_type, in2_type}, this.sheet.env);
    if(error)
        throw Error(error);

    const port_default = {visible_name: false};

    this.createPorts(
        {...port_default, direction: "out", dataType: "bool", name: "out", passThrough: true},
        {...port_default, direction: "in", dataType: in1_type, name: "a", visible_value: "auto"},
        {...port_default, direction: "in", dataType: in2_type, name: "b", visible_value: "auto"}
    );
    this.setAttr(attr_op, op);
    this.setAttr(attr_in1Type, in1_type);
    this.setAttr(attr_in2Type, in2_type);
    setOperation(this, operations, op);
}

function getPassThroughValue(port) {
    return getOperationResult(this, "a", "b");
}

function exportJSON() {
    return {
        op: this.getAttr(attr_op),
        in1_type: this.getAttr(attr_in1Type),
        in2_type: this.getAttr(attr_in2Type),
    }
}

export {
    onCreate,
    getPassThroughValue,
    getParameters,
    checkParameters,
    exportJSON
}