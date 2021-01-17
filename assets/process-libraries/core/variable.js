
function getParameters() {
    return [{
        key: "type", name: "type",
        type: "string",
        default: "any"
    }, {
        key: "value", name: "value",
        type: "string",
        default: ""
    }];
}

/**
 * @param {string} type
 * @param {string|any} value
 * @param {FbpEnvironment} env
 * @return {string|null}
 */
function checkParameters({type, value}, env) {
    if ((type === "void"))
        return "\"void\" type cannot be used for variables"
    const fbpType = env.getType(type);
    if (!fbpType)
        return `unkown type ${type}`;
    if (value !== undefined && value.substr && value.length > 0) {
        if (!fbpType.parse)
            return `cannot set initial value for type ${type}.`+
                "variable will be created uninitialized.";
        if (fbpType.parse(value) === undefined) {
            return `cannot convert text value ${value} to type ${type}`;
        }
    }
    return null;
}

/**
 * @param {boolean} event
 * @param {string} type
 */
function onCreate({type="any", value = undefined}) {

    const error = checkParameters({type, value}, this.sheet.env);
    if (error)
        throw Error(error);

    this.createPorts(
        {active: true, direction: "in", dataType: "void", name: "write", visible_name: false, visible_value: "auto"},
        {active: false, direction: "in", dataType: type, name: "D", visible_name: false, visible_value: "auto"},
        {active: false, direction: "out", dataType: type, name: "Q", visible_name: false, visible_value: true}
    );
    if (value !== undefined && value.substr) {
        const v = this.sheet.env.getType(type).parse(value);
        this.getOutputPort(0).value = v;
    }
    this.setAttr("color", '#800');
}

function getPassThroughValue(port) {
    return this.getPort("in", "in").value;
}

function onPacket(packet) {
    this.getOutputPort(0).value = this.getInputPort(1).value;
}

function exportJSON() {
    const out_port = this.getOutputPort(0);
    const fbpType = out_port.dataType;
    return {
        type: fbpType.name,
        ...(fbpType.str ? {value: fbpType.str(out_port.value)} : {})
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