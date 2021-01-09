import {PRNG} from "../../../../jslib/utils/tools.mod.js";
import {getOperationResult, getOperationsDisplay, setOperation} from "./_base.js";

const prngSym = Symbol("PRNG");

const module_name = "math.prng";

function getParameters() {
    return [{
        key:"int_only", name: "only integers",
        type: "checkbox",
        default: "false"
    }, {
        key:"min", name: "range minimum (included)",
        type: "float",
        default: "0"
    }, {
        key:"max", name: "range maximum (excluded)",
        type: "float",
        default: "10"
    }, {
        key: "seed", name: "PRNG seed",
        type: "int",
        default: Math.abs(Math.round(Math.random()))
    }];
}

function checkParameters({int_only, min, max, seed}, fbpSheet) {
    if(Number.isNaN(min) || Number.isNaN(max) || Number.isNaN(seed))
        return `min, max and seed must be numbers`;
    if(max <= min)
        return `range maximum must be strictly superior to range minimum`;
}

function onCreate({int_only, min, max, seed}) {
    const error = checkParameters({int_only, min, max}, this.sheet);
    if(error)
        throw Error(error);

    const port_default = {passive: true};
    const type = int_only ? "int" : "float";

    const input_common = {
        direction: "in", dataType: type,
        visible_name: true, visible_value: "auto"
    };

    this.createPorts(
        {
            name: "out", direction: "out", dataType: type,
            passThrough: true, visible_name: false
        },
        {name: "min", ...input_common},
        {name: "max", ...input_common}
    );
    this.getPort("min", "in").value = min;
    this.getPort("max", "in").value = max;
    this.setAttr("color", '#080');
    this.setAttr("visible_name", true);
    /*
    const opElmt = document.createElement("span");
    opElmt.className = "simple-op";
    opElmt.innerHTML = "\uD83C\uDFB2";
    this.setAttr("display_operation", opElmt);
     */
    this[prngSym] = new PRNG(seed);
}

function getPassThroughValue(port) {
    const min = this.getPort("min", "in").value;
    const max = this.getPort("max", "in").value;
    return (this.getOutputPort(0).dataType.name === "int")
        ? this[prngSym].nextRanged(min, max)
        : this[prngSym].nextRangedFloat(min, max);
}

function exportJSON() {
    return {
        int_only: this.getOutputPort(0).dataType.name === "int",
        min: this.getPort("min", "in").value,
        max: this.getPort("max", "in").value,
        seed: this[prngSym].seed
    };
}

export {
    onCreate,
    getPassThroughValue,
    getParameters,
    checkParameters,
    exportJSON,
}