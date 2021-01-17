function onCreate() {
    this.createPorts(
        {passive: true, direction: "in", type: "int", name: "sel"},
        {passive: true, direction: "in", type: "any", name: "in0"},
        {passive: true, direction: "in", type: "any", name: "in1"},
        {passive: true, direction: "out", type: "any", name: "out", passThrough: true},
    );
    this.name = "MUX";
}

function getPassThroughValue(port) {
    const sel = this.getPort("sel", "in").value
    const inputPort = this.getPort("in"+sel, "in")
    if (inputPort !== undefined)
      return inputPort.value;
    else return undefined;
}

export {
    onCreate,
    getPassThroughValue,
}