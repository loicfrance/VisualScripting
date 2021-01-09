
import {Vec2} from "../../jslib/geometry2d/Vec2.mod.js";
import {debug, requestFilesFromUser, textFileUserDownload} from "../../jslib/utils/tools.mod.js";
import DesignBoard from "./design/DesignBoard.mod.js";
import {FbpPortDirection, FbpProcess} from "./FBP/fbp.mod.js";
import {FbpSheet} from "./FBP/FbpSheet.mod.js";
import FbpType from "./FBP/FbpType.mod.js";
import FbpLoader from "./FbpLibLoader.mod.js";
import SidePanel from "./SidePanel.mod.js";

async function main() {
    debug.enableTags("VS-debug");

    const fbpSheet = new FbpSheet();
    fbpSheet.libLoader = new FbpLoader("/VisualScripting/assets/process-libraries/");
    await fbpSheet.libLoader.finishLoadings();
    fbpSheet.libLoader.displayLib(document.getElementById("process-lib"), "");
    fbpSheet.libLoader.loadTypesLib("core/base-types")
        .then(types=>
            fbpSheet.setTypes(types.getTypes(FbpType))
        );
    fbpSheet.libLoader.loadHandler("core/variable");
    fbpSheet.libLoader.loadHandler("core/node");
    fbpSheet.libLoader.loadHandler("math/op2");
    fbpSheet.libLoader.loadHandler("math/prng");
    fbpSheet.libLoader.loadHandler("web-debug/alert");
    await fbpSheet.libLoader.finishLoadings();
    // noinspection JSCheckFunctionSignatures
    const board = new DesignBoard(document.getElementsByClassName("board")[0]);
    board.fbpSheet = fbpSheet;

    const trigger = new FbpProcess(fbpSheet, {name: "trigger",
        handler: "core/node", parameters: {
            event: true, type: "void", nb_out: 4
        }, position: Vec2.zero});

    const random = new FbpProcess(fbpSheet, {name: "random",
        handler: "math/prng", parameters: {
            int_only: true, min: 5, max: 9
        }, position: new Vec2(0,100)});

    const rand_vars = [
        new FbpProcess(fbpSheet, {name: "a",
            handler: "core/variable", parameters: { type: "int" },
            position: new Vec2(0,0)}),
        new FbpProcess(fbpSheet, {name: "b",
            handler: "core/variable", parameters: { type: "int" },
            position: new Vec2(0,0)}),
        new FbpProcess(fbpSheet, {name: "c",
            handler: "core/variable", parameters: { type: "int" },
            position: new Vec2(0,0)}),
        ];
    trigger.getOutputPort(0).connect(rand_vars[0].getInputPort(0));
    trigger.getOutputPort(1).connect(rand_vars[1].getInputPort(0));
    trigger.getOutputPort(2).connect(rand_vars[2].getInputPort(0));

    const product = new FbpProcess(fbpSheet, {name:"product",
        handler: "math/op2", parameters: {
            op:"multiply", in1_type: "float", in2_type: "float"
        }, position: new Vec2(0,-50)});

    rand_vars[0].getOutputPort(0).connect(product.getInputPort(0));
    rand_vars[1].getOutputPort(0).connect(product.getInputPort(1));

    const sum = new FbpProcess(fbpSheet, {name:"sum",
        handler:  "math/op2", parameters: {
            op:"plus", in1_type: "float", in2_type: "float"
        }, position: new Vec2(0,50)});
    product.getOutputPort(0).connect(sum.getInputPort(0));
    rand_vars[2].getOutputPort(0).connect(sum.getInputPort(1));


    const alertProc = new FbpProcess(fbpSheet, {name: "alert",
        handler: "web-debug/alert", parameters: {
            in_size: 1
        }, position: new Vec2(100,0)});

    trigger.getOutputPort(3).connect(alertProc.getInputPort(0));
    sum.getOutputPort(0).connect(alertProc.getInputPort(1));


    window.board = board;
    const infoPanel = new SidePanel(document.getElementById("info-panel"));
    //const optionsPanel = new SidePanel(document.getElementById("options-panel"));
    const saveBtn = document.getElementById("save-sheet");
    const openBtn = document.getElementById("open-sheet");
    saveBtn.addEventListener("click", (evt)=> {
        textFileUserDownload(JSON.stringify(fbpSheet.exportJSON(),
            (key, value) =>
                    (key === "id" && value instanceof Number) ? "#"+value.toString(16)
                    : value
                ,
            2),
            "sheet.json"
        );
    });
    openBtn.addEventListener('click', (evt)=> {
        requestFilesFromUser({multiple:false, accept: "text/json"})
            .then((files)=> {
                if (files.length === 0) return;
                board.fbpSheet.clearProcesses();
                // TODO clear and load types
                // board.fbpSheet.clearTypes();
                for(let /** @type {File} */f of files) {
                    f.text().then(JSON.parse).then(
                        board.fbpSheet.importJSON.bind(board.fbpSheet)
                    );
                }
            });
    });
}
window.onload = main;