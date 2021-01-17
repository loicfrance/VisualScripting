import {getOperationsDisplay, setOperation, getOperationResult} from "./_base.js";

const module_name = "math.trigo";
const attr_op = module_name + ".operation";

const operations = {
    cos     : {display: "cos",                  f: Math.cos  },
    sin     : {display: "sin",                  f: Math.sin  },
    tan     : {display: "tan",                  f: Math.tan  },
    cosh    : {display: "cosh",                 f: Math.cosh },
    sinh    : {display: "sinh",                 f: Math.sinh },
    tanh    : {display: "tanh",                 f: Math.tanh },
    acos    : {display: "cos<sup>-1</sup>",     f: Math.acos },
    asin    : {display: "sin<sup>-1</sup>",     f: Math.asin },
    atan    : {display: "tan<sup>-1</sup>",     f: Math.atan },
    acosh   : {display: "cosh<sup>-1</sup>",    f: Math.acosh},
    asinh   : {display: "sinh<sup>-1</sup>",    f: Math.asinh},
    atanh   : {display: "tanh<sup>-1</sup>",    f: Math.atanh},
};

function getParameters() {
    return [{
        key: "op", name: "operation",
        type: "select", values: getOperationsDisplay(operations),
        default: "cos"
    }];
}

/**
 * @param {string} op
 * @param {FbpEnvironment} env
 * @return {string|null}
 */
function checkParameters({op}, env) {
    if (!(op.substr && operations.hasOwnProperty(op)))
        return `unknown operation ${op}`;
    return null;
}

/**
 * @param {string} name
 * @param {string} op
 */
function onCreate({op="cos"}) {

    const error = checkParameters({op}, this.sheet.env);
    if(error)
        throw Error(error);

    const ports_common = {passive: true, dataType: "float", visible_name: false};

    this.createPorts(
        {...ports_common, direction: "in", name: "in", visible_value: "auto"},
        {...ports_common, direction: "out", name: "out", passThrough: true}
    );
    this.setAttr(attr_op, op);
    setOperation(this, operations, op);
}

function getPassThroughValue(port) {
    return getOperationResult(this, "in");
}

function exportJSON() {
    return {
        op: this.getAttr(attr_op),
    };
}

export {
    onCreate,
    getPassThroughValue,
    getParameters,
    checkParameters,
    exportJSON,
}