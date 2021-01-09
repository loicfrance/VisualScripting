

function getParameters() {
    return [{
        key: "attrs", name: "attributes",
        type: "list", element: [{
            key: "name", name: "attribute name",
            type: "string", default: ""
        }, {
            key: "type", name: "attribute type",
            type: "string", default: "any"
        }],
        size: [1, Infinity],
        default: []
    }]
}

function checkParameters({attrs}, fbpSheet) {
    if (!Array.isArray(attrs) || attrs.length === 0)
        return `attrs attribute must be a non-empty array`;
    for (let attr of attrs) {
        if (!("name" in attr))
            return `missing "name" attribute in attr ${attr}`;
        if ("type" in attr) {
            if (attr.type === "void")
                return `void type forbidden for passive values`;
            if (!fbpSheet.getType(attr.type))
                return `unknown type ${attr.type}`;
        } else {
            return `type is missing for attribute "${attr}"`;
        }
    }
    return null;
}

function onCreate({attrs = []}) {
    const error = checkParameters({attrs}, this.sheet);
    if(error)
        throw Error(error);

    this.createPorts(
        {passive: false, direction: "in", type: "any", name: "packet-in"},
        {passive: false, direction: "out", type: "any", name: "packet-out"}
    );
    for (let attr of attrs)
        this.createPort({passive: true, direction: "in", type: attr.type, name: attr.name});
    this.name = "process set";
}

function onPacket(port, packet) {
    const nb_outputs = this.outputSize;

    for (let i = 0; i < nb_outputs; i++) {
        const port = this.getInputPort(i);
        if (port.active)
            continue;
        packet[port.name] = port.value;
    }
    this.getPort("packet-out", "out").send(packet);
}

function exportJSON() {
    const nb_inputs = this.inputSize;
    const attrs = [];
    for (let i = 0; i < nb_inputs; i++) {
        const port = this.getInputPort(i);
        if (port.passive) {
            const name = port.name;
            attrs.push({name: port.name, type: port.dataType.name});
        }
    }
    return {
        attrs: attrs,
    };
}

export {
    getParameters,
    checkParameters,
    onCreate,
    onPacket,
    exportJSON,
}