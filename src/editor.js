import {Component, Engine, Input, NodeEditor, Output, Socket} from "./rete";
import VueRenderPlugin from "./plugin";
import ContextMenuPlugin from "rete-context-menu-plugin";
import CommentPlugin from "./comment"
import AreaPlugin from "rete-area-plugin";
import HistoryPlugin from "rete-history-plugin";
import {g} from "./plugin/groupComponents.js";
import ConnectionPlugin from './connection';
import jsonData from "./test.json" 

let numSocket = new Socket("Number Value");


class MathComponent extends Component {
    doOperation() {
        return 0;
    }

    builder(node) {
        let inp1 = new Input("num1", "Value 1", numSocket);
        let inp2 = new Input("num2", "Value 2", numSocket);
        let out = new Output("num", "Result", numSocket);
        return node
            .addInput(inp1)
            .addInput(inp2)
            // .addControl(new NumControl(this.editor, "preview", true))
            .addOutput(out);
    }


}

class AddComponent extends MathComponent {
    constructor() {
        super("add");
    }

    doOperation(v1, v2) {
        return v1 + v2;
    }
}


export async function createFlowEditor() {

    let container = document.querySelector("#rete");
    let c = new AddComponent();

    let editor = new NodeEditor("demo@0.1.0", container);
    window.editor = editor;
    editor.use(ConnectionPlugin);
    editor.use(VueRenderPlugin);
    editor.use(AreaPlugin);
    editor.use(CommentPlugin);
    editor.use(HistoryPlugin);
    //editor.use(ConnectionMasteryPlugin);
   // let grpIdx = 1;
    editor.use(ContextMenuPlugin, {
        searchBar: false,
        items: {
            "group": () => {
               console.log(editor.toJSON())
            }
        },
        allocate() {
            return ["+ New"];
        },
        rename(component) {
            return component.name;
        }
    });

    let engine = new Engine("demo@0.1.0");

    editor.register(c);
    engine.register(c);
    editor.register(g);
    engine.register(g);
    editor.on("multiselectnode", (args) => args.accumulate = args.e.ctrlKey || args.e.metaKey);

    // for (let i = 0; i < 10; i++) {
    //     let add = await c.createNode({ "group": i > 0 && i < 5 ? "group1" : null });
    //     if (add) {
    //         add.title = "n:" + i;
    //         add.position = [i * 150, 240];
    //         if (i > 0 && i < 5) {
    //             add.position[1] += 190;
    //         }
    //         editor.addNode(add);
    //     }
    //     if (i > 0) {
    //         editor.connect(editor.nodes[i-1].outputs.get("num"), editor.nodes[i].inputs.get("num1"))

    //     }
    //     // if (i % 2 === 0) {
    //     //     let add = await g.createNode({"group": i % 2 === 0 ? "group1" : null});
    //     //     add.position = [Math.random() * 500, Math.random() * 240];
    //     //     editor.addNode(add);
    //     // }
    // }
    editor.fromJSON(jsonData)
    editor.view.resize();
    AreaPlugin.zoomAt(editor);
    editor.trigger("process");
    editor.trigger("nodeselected")
}
