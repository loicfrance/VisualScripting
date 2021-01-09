import {getOperationsDisplay, setOperation, getOperationResult} from "./_base.js";

const module_name = "math.binary";
const attr_op = module_name + ".operation";
const attr_bool = module_name + ".bool_op";

const operations = {
    and: {display: "&", f: (a, b) => a & b},
    or: {display: "\u2225", f: (a, b) => a | b},
    xor: {display: "\u2295", f: (a, b) => a ^ b},
    lshift: {display: "<<", f: (a, b) => a << b},
    rshift: {display: ">>", f: (a, b) => a >> b},
    not: {display: "~", f: (a) => ~a},
}

function getParameters() {
    return [{
        key: "op", name: "operation",
        type: "select", values: getOperationsDisplay(operations),
        default: "and"
    }, {
        key: "bool_op", name: "boolean",
        type: "checkbox", default: false
    }];
}

/**
 * @param {string} op
 * @param {boolean} bool_op
 * @param {FbpSheet} fbpSheet
 * @return {string|null}
 */
function checkParameters({op, bool_op}, fbpSheet) {
    if (!(op.substr && operations.hasOwnProperty(op)))
        return `unknown operation ${op}`;
    if (bool_op && ["lshift", "rshift"].includes(op))
        return "boolean operation incompatible with '<<' and '>>'";
    return null;
}

/**
 * @param {string} name
 * @param {string} op
 * @param {boolean} bool_op
 */

function onCreate({op = "and", bool_op = false}) {

    const error = checkParameters({op, bool_op}, this.sheet);
    if (error)
        throw Error(error);

    const type = bool_op ? "bool" : "int"
    const port_default = {passive: true, dataType: type, visible_name: false};
    this.createPorts(
        {...port_default, direction: "out", name: "out", passThrough: true},
        {...port_default, direction: "in", name: "a", visible_value: "auto"}
    );
    if (op !== "not")
        this.createPort({...port_default, direction: "in", name: "b", visible_value: "auto"});
    this.setAttr(attr_op, op);
    this.setAttr(attr_bool, bool_op);
    setOperation(this, operations, op);
}

function getPassThroughValue(port) {
    return getOperationResult(this, "a", "b");
}

function exportJSON() {
    return {
        op: this.getAttr(attr_op),
        bool_op: this.getAttr(attr_bool)
    }
}

export {
    onCreate,
    getPassThroughValue,
    getParameters,
    checkParameters,
    exportJSON
}