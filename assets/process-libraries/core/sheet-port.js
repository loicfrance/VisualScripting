
function getParameters() {
    return [{
        key: "dir", name: "direction",
        type: "select", values: {
            in: "input",
            out: "output"
        },
        default: "in"
    }, {
        key: "ports", name: "ports",
        type: "list", element: [{
            key: "active", name: "active port",
            type: "checkbox", default: false
        }, {
            key: "name", name:"port name",
            type: "string", default: ""
        }, {
            key: "type", name:"port type",
            type: "string", default: "any"
        }],
        size: [1, Infinity]
    }]
}

function checkParameters({dir, ports}, env) {
    if (!(["in", "out"].includes(dir)))
        return `unknown port direction ${dir}`;
    if (!(Array.isArray(ports) && ports.length > 0))
        return `"ports" attribute must be a non-empty array`;
    for (let p of ports) {
        if (!(p.name.substr && p.name.length > 0))
            return 'port name must be a non-empty string';
        if (!p.active && p.type === 'void')
            return `void type is forbidden for passive ports`;
        if (!env.getType(p.type))
            return `unknown type ${p.type}`;
    }
    return null;
}

function onCreate({dir, ports}) {
    const error = checkParameters({dir, ports}, this.sheet);
    if(error)
        throw Error(error);

    for(let p of ports) {
        this.createPort({direction: dir, passive: !p.active, passThrough: !p.active, name: p.name, type: p.type});
    }
}
function getPassThroughValue(port) {
    //TODO
    return undefined;
}
function onPacket(port, packet) {
    //TODO
}