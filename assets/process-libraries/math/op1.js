import {getOperationsDisplay, setOperation, getOperationResult} from "./_base.js";

const module_name = "math.op1";
const attr_op = module_name+".operation";
const attr_type = module_name+".in_type";

const operations = {
    minus   : {display: "-x"                    , f: (a)=>-a},
    abs     : {display: "|x|"                   , f: Math.abs},
    sqrt    : {display: "\u221a(x)"             , f: Math.sqrt, out_type: "float"},
    cbrt    : {display: "\u221b(x)"             , f: Math.cbrt, out_type: "float"},
    exp     : {display: "e<sup>x</sup>"         , f: Math.exp, out_type: "float"},
    expm1   : {display: "e<sup>x</sup>-1"       , f: Math.expm1, out_type: "float"},
    log     : {display: "ln(x)"                 , f: Math.log, out_type: "float"},
    log1p   : {display: "ln(1+x)"               , f: Math.log1p, out_type: "float"},
    log2    : {display: "log<inf>2</inf>(x)"    , f: Math.log2, out_type: "float"},
    log10   : {display: "log<inf>10</inf>(x)"   , f: Math.log10, out_type: "float"},
    sign    : {display: "sign"                  , f: Math.sign, out_type: "int"},
    trunc   : {display: "trunc"                 , f: Math.trunc, in_type: "float", out_type: "int"},
    round   : {display: "round"                 , f: Math.round, in_type: "float", out_type: "int"},
    floor   : {display: "floor"                 , f: Math.floor, in_type: "float", out_type: "int"},
    ceil    : {display: "ceil"                  , f: Math.ceil, in_type: "float", out_type: "int"},
};

const types = {
    int: "int",
    float: "float"
};

function getParameters() {
    return [{
        key:"op", name: "operation",
        type: "select", values: getOperationsDisplay(operations),
        default: "minus"
    }, {
        key:"in_type", name: "input type",
        type: "select", values: types,
        default: "float"
    }];
}

/**
 *
 * @param {string} op
 * @param {string} in_type
 * @param {FbpSheet} fbpSheet
 * @return {null|string}
 */
function checkParameters({op, in_type}, fbpSheet) {
    if (!(op.substr && operations.hasOwnProperty(op)))
        return `unknown operation ${op}`;
    if (!(in_type.substr && types.hasOwnProperty(in_type)))
        return `incompatible type ${op}`;
    if (operations[op].in_type !== in_type)
        return `operator ${op} incompatible with input type ${in_type}`;
    return null;
}

/**
 * @param {string} op
 * @param {string} in_type
 */
function onCreate({op="minus", in_type="float"}) {

    const error = checkParameters({op, in_type}, this.sheet);
    if(error)
        throw Error(error);

    const out_type = operations[op].hasOwnProperty("out_type") ?
            operations[op].out_type :
            in_type;

    const port_common = {visible_name: false};

    this.createPorts(
        {...port_common, direction: "in", dataType: in_type, name: "in", visible_value: "auto"},
        {...port_common, direction: "out", dataType: out_type, name: "out", passThrough: true}
    );
    this.setAttr(attr_op, op);
    this.setAttr(attr_type, in_type);
    setOperation(this, operations, op);
}

function getPassThroughValue(port) {
    return getOperationResult(this, "in");
}

function exportJSON() {
    return {
        op: this.getAttr(attr_op),
        in_type: this.getAttr(attr_type)
    };
}

export {
    onCreate,
    getPassThroughValue,
    getParameters,
    checkParameters,
    exportJSON,
}