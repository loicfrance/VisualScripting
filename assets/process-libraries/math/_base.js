
const opSym = Symbol("operation");

function getOperationsDisplay(operations) {
    return Object.fromEntries(
        Object.entries(operations).map(
            ([key, value])=>
                [key, value.display]
        )
    );
}
/*
function onChange(key, ...args) {
    switch(key) {
        case 'port_changed' :
            switch(args[1]) {
                case 'connection' : {
                    const port = args[0];
                    if (port.input) {
                        port.setAttr('visible_value', port.connections.length === 0);
                    }
                    break;
                }
            }
            break;
        default:
            break;
    }

}
*/

function setOperation(process, operations, op) {
    process[opSym] = operations[op].f;
    process.setAttr("color", '#080');
    process.setAttr("visible_name", false);
    const opElmt = document.createElement("span");
    opElmt.className = "simple-op";
    opElmt.innerHTML = operations[op].display;
    process.setAttr("display_operation", opElmt);
}

function getOperationResult(process, ...in_port_names) {
    return process[opSym].apply(process,
        in_port_names
            .map(n=>process.getPort(n, "in"))
            .filter(p=>p)
            .map(p=>p.value)
    );
}

export {
    getOperationsDisplay,
    setOperation,
    getOperationResult,
    //onChange,
}