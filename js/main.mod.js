
import {Vec2} from "../../jslib/geometry2d/Vec2.mod.js";
import {debug, loadString, merge, requestFilesFromUser, textFileUserDownload} from "../../jslib/utils/tools.mod.js";
import DesignBackground from "./design/DesignBackground.mod.js";
import DesignEnvironment from "./design/DesignEnvironment.mod.js";
import DesignSheet from "./design/DesignSheet.mod.js";
import Editor from "./Editor.mod.js";
import {FbpPortDirection, FbpProcess} from "./FBP/fbp.mod.js";
import SidePanel from "./SidePanel.mod.js";

async function main() {
    debug.enableTags("VS-debug");
    const env = new DesignEnvironment();
    window.fbpEnv = env;
    env.libLoader.addRootUrl("/VisualScripting/assets/process-libraries/")
        .then(async () => {
            // noinspection ES6MissingAwait
            env.importTypes("core/base-types");
            env.libLoader.loadHandler("core/variable");
            env.libLoader.loadHandler("core/node");
            env.libLoader.loadHandler("math/op2");
            env.libLoader.loadHandler("math/prng");
            env.libLoader.loadHandler("web-debug/alert");
            await env.libLoader.finishLoadings();
        })
        .then(()=>{
            const trigger = fbpSheet.createProcess({name: "trigger",
                handler: "core/node", parameters: {
                    event: true, type: "void", nb_out: 4
                }, position: Vec2.zero});

            const random = fbpSheet.createProcess({name: "random",
                handler: "math/prng", parameters: {
                    int_only: true, min: 5, max: 9
                }, position: new Vec2(0,100)});

            const rand_vars = fbpSheet.createProcesses(
                {
                    name: "a",
                    handler: "core/variable", parameters: { type: "int" },
                    position: new Vec2(0,0)
                }, {
                    name: "b",
                    handler: "core/variable", parameters: { type: "int" },
                    position: new Vec2(0,0)
                }, {
                    name: "c",
                    handler: "core/variable", parameters: { type: "int" },
                    position: new Vec2(0,0)
                });
            trigger.getOutputPort(0).connect(rand_vars[0].getInputPort(0));
            trigger.getOutputPort(1).connect(rand_vars[1].getInputPort(0));
            trigger.getOutputPort(2).connect(rand_vars[2].getInputPort(0));

            const product = fbpSheet.createProcess({name:"product",
                handler: "math/op2", parameters: {
                    op:"multiply", in1_type: "float", in2_type: "float"
                }, position: new Vec2(0,-50)});

            rand_vars[0].getOutputPort(0).connect(product.getInputPort(0));
            rand_vars[1].getOutputPort(0).connect(product.getInputPort(1));

            const sum = fbpSheet.createProcess({name:"sum",
                handler:  "math/op2", parameters: {
                    op:"plus", in1_type: "float", in2_type: "float"
                }, position: new Vec2(0,50)});
            product.getOutputPort(0).connect(sum.getInputPort(0));
            rand_vars[2].getOutputPort(0).connect(sum.getInputPort(1));


            const alertProc = fbpSheet.createProcess({name: "alert",
                handler: "web-debug/alert", parameters: {
                    in_size: 1
                }, position: new Vec2(100,0)});

            trigger.getOutputPort(3).connect(alertProc.getInputPort(0));
            sum.getOutputPort(0).connect(alertProc.getInputPort(1));
        });

    const fbpSheet = env.createSheet("sheet 0");
    env.editSheet(fbpSheet);
    env.enableKeyboardShortcuts();
    const editor = env.focusedEditor;
    editor.designSheet.background = new DesignBackground(editor.htmlDiv, {});
    editor.enableKeyboardShortcuts();
    loadString("assets/shortcuts.json")
        .then(JSON.parse)
        .then()
        .then(mapping=> {
            const defaultMapping = mapping['default'    ] || {};
            const editorMapping  = mapping['editor'     ] || {};
            const envMapping     = mapping['environment'] || {};
            merge(editorMapping, defaultMapping, false);
            merge(envMapping   , defaultMapping, false);
            editor.setKeyboardShortcuts(new Map(Object.entries(editorMapping)));
            env   .setKeyboardShortcuts(new Map(Object.entries(envMapping   )));
        });
    //designSheet.requestCameraControl();

    const infoPanel = new SidePanel(document.getElementById("info-panel"));
    //const optionsPanel = new SidePanel(document.getElementById("options-panel"));
    const saveBtn = document.getElementById("save-sheet");
    const openBtn = document.getElementById("open-sheet");

}
window.onload = main;