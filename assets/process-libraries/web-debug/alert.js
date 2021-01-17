

function getParameters() {
    return [{
        key: "in_size", name: "input size",
        type: "int", range: [0,Infinity],
        default: 1
    }];
}

function checkParameters({in_size}, env) {
    if(Number.isNaN(in_size) || !Number.isInteger(in_size) || in_size < 0)
        return `in_size parameter must be a positive integer`;
    return null;
}

function onCreate({in_size=1}) {
    const error = checkParameters({in_size}, this.sheet.env);
    if(error)
        throw Error(error);

    const ports_common = {direction:"in", visible_name: false, visible_value: "auto"};
    this.createPort({...ports_common, name:"run", dataType: (in_size > 0 ? "void" : "any"), active:true});
    for(let i = 0; i < in_size; i++) {
        this.createPort({...ports_common, name: "in"+i, dataType: "any"});
    }
}

function onPacket(port, packet) {
    const inputSize = this.inputSize - 1;
    if (inputSize === 0) {
        alert(packet.data);
    } else {
        const values = new Array(inputSize);
        for(let i = 0; i < inputSize; i++) {
            values[i] = this.getInputPort(i+1).value;
        }
        alert(...values);
    }
}
function exportJSON() {
    return {
        in_size: this.inputSize - 1,
    };
}

export {
    onCreate,
    onPacket,
    getParameters,
    checkParameters,
    exportJSON,
}