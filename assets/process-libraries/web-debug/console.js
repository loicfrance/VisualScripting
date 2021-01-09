const module_name = "web-debug.console";
const attr_function = module_name + ".function";

const functions = {
    log: Infinity,
    info: Infinity,
    debug: Infinity,
    warn: Infinity,
    error: Infinity,
    assert: Infinity,
    dir: 1,
    table: 1,
    time: 1,
    timeEnd: 1,
    timeLog: 1,
    count: 0,
    countReset: 0,
    group: 0,
    groupCollapsed: 0,
    groupEnd: 0,
    clear: 0,
}

function getParameters() {
    return [{
        key: "func", name: "function",
        type: "select", values: Object.keys(functions),
        default: "log"
    }, {
        key: "in_size", name: "input size",
        type: "int", range: [0,Infinity],
        default: 1
    }];
}

function checkParameters({func, in_size}, fbpSheet) {
    if(!functions.hasOwnProperty(func))
        return `unkown console function ${func}`;
    if(!(func in console))
        return `function ${func} is not implemented in this browser`;
    if(Number.isNaN(in_size) || !Number.isInteger(in_size) || in_size < 0)
        return `in_size parameter must be a positive integer`;
    if (in_size > functions[func])
        return `too much inputs for function ${func}. Max ${functions[func]}.`
    return null;
}

function onCreate({func="log", in_size=1}) {
    const error = checkParameters({func, in_size}, this.sheet);
    if(error)
        throw Error(error);

    const ports_common = {direction:"in", visible_name: false, visible_value: "auto"};
    const isVoid = (in_size > 0 || functions[func] === 0)
    this.createPort({...ports_common, name:"run", dataType: (isVoid ? "void" : "any"), active:true});
    for(let i = 0; i < in_size; i++) {
        this.createPort({...ports_common, name: "in"+i, dataType: "any"});
    }
    this.setAttr(attr_function, func);
}

function onPacket(port, packet) {
    const inputSize = this.inputSize - 1;
    if (inputSize === 0) {
        console[this.getAttr(attr_function)](packet.data);
    } else {
        const values = new Array(inputSize);
        for(let i = 0; i < inputSize; i++) {
            values[i] = this.getInputPort(i+1).value;
        }
        console[this.getAttr(attr_function)](...values);
    }
}

function exportJSON() {
    return {
        func: this.getAttr(attr_function),
        in_size: this.inputSize - 1,
    }
}

export {
    onCreate,
    onPacket,
    getParameters,
    checkParameters
}