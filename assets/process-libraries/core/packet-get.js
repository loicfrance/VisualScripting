
const module_name = "core.packet-get";
const attr_evt_out = module_name + ".evt_out";

const event_out_values = {
    in_evt: "unmodified input event",
    rmv_attrs: "input event without exported attributes",
    void: "event without content",
    none: "no event output"
};

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
    }, {
        key: "event_out", name: "event out",
        type: "select", values: event_out_values,
        default: "none"
    }]
}

function checkParameters({attrs, event_out}, fbpSheet) {
    if (!Array.isArray(attrs) || attrs.length === 0)
        return `attrs attribute must be a non-empty array`;
    if (!event_out_values.hasOwnProperty(event_out))
        return `unknown event_out value ${event_out}`;
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

function onCreate({attrs = [], event_out}) {
    const error = checkParameters({attrs, event_out}, this.sheet);
    if(error)
        throw Error(error);

    this.createPort({active: true, direction: "in", type: "any", name: "packet-in"});
    if (event_out !== "none")
        this.createPort({active: true, direction: "out", type: "any", name: "packet-out"});

    for (let attr of attrs)
        this.createPort({active: false, direction: "out", type: attr.type, name: attr.name});
    this.setAttr(attr_evt_out, event_out);
}

function onPacket( in_port, packet) {
    const nb_outputs = this.outputSize;

    for (let i = 0; i < nb_outputs; i++) {
        const port = this.getOutputPort(i);
        if (port.active)
            continue;
        const name = port.name;
        if(name in packet) {
            port.value = packet[name];
            delete (packet[name]);
        } else {
            port.value = undefined;
        }
    }
    this.getPort("packet-out", "out").send(packet);
}

function exportJSON() {
    const nb_outputs = this.outputSize;
    const attrs = [];
    for (let i = 0; i < nb_outputs; i++) {
        const port = this.getOutputPort(i);
        if (port.passive) {
            const name = port.name;
            attrs.push({name: port.name, type: port.dataType.name});
        }
    }
    return {
        attrs: attrs,
        event_out: this.getAttr(attr_evt_out),
    };
}

export {
    getParameters,
    checkParameters,
    onCreate,
    onPacket,
    exportJSON
}