
function getParameters() {
    return [{
        key: "event", name: "event",
        type: "checkbox",
        default: "false"
    }, {
        key: "type", name: "type",
        type: "string",
        default: "any"
    }, {
        key: "nb_out", name: "number of outputs",
        type: "int", range: [1,Infinity],
        default: 1
    }];
}

/**
 * @param {boolean} event
 * @param {string} type
 * @param {number} nb_out
 * @param {FbpEnvironment} env
 * @return {string|null}
 */
function checkParameters({event, type, nb_out}, env) {
    if (!event && (type === "void"))
        return "\"void\" type can only be used for event nodes"
    if (Number.isNaN(nb_out) || !Number.isInteger(nb_out) || nb_out <= 0)
        return "the number of output must be a positive integer."
    return null;
}

/**
 * @param {boolean} event
 * @param {string} type
 * @param {number} nb_out
 */
function onCreate({event, type, nb_out}) {

    const error = checkParameters({event, type, nb_out}, this.sheet.env);
    if(error)
        throw Error(error);

    const ports_common = {
        active: event, dataType: type,
        visible_name: false, visible_value: "auto"
    };

    this.createPort({direction: "in", name: "in", ...ports_common});

    for(let i = 0; i < nb_out; i++) {
        this.createPort({
            direction: "out", name: `out_${i.toString()}`, passThrough: !event,
            ...ports_common
        });
    }
    this.setAttr("visible_name", false);

}

function getPassThroughValue(port) {
    return this.getPort("in", "in").value;
}

function onPacket(packet) {
    const nb_out = this.outputSize;
    for(let i = 0; i < nb_out; i++) {
        this.getOutputPort(i).send(packet);
    }
}

function exportJSON() {
    const in_port = this.getInputPort(0);
    return {
        event: in_port.active,
        type: in_port.dataType.name,
        nb_out: this.outputSize,
    };
}

export {
    onCreate,
    getPassThroughValue,
    onPacket,
    getParameters,
    checkParameters,
    exportJSON,
}