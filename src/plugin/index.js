/* eslint-disable  */
import "./filters";
import Node from "./Node.vue";
import Socket from "./Socket.vue";
import Vue from "vue";
import mixin from "./mixin";
import { Node as ReteNode } from "../rete";

function createVue(el, vueComponent, vueProps, options = {}) {
    // console.log("createVue", el, vueComponent, vueProps, options);
    const app = new Vue({
        render: h => {
            // console.log(vueComponent, vueProps.node.id);
            return h(vueComponent, { props: vueProps });
        },
        ...options
    });

    const nodeEl = document.createElement("div");

    el.appendChild(nodeEl);
    app.$mount(nodeEl);

    return app;
}

function createNode(editor, CommonVueComponent, { el, node, component, bindSocket, bindControl }, options) {
    // console.log({editor, CommonVueComponent, data: {el, node, component, bindSocket, bindControl}, options});
    let vueComponent = component.component || CommonVueComponent || Node;
    let vueProps = { ...component.props, node, editor, bindSocket, bindControl };
    // if (node.data.group) {
    //     const groupNode = editor.nodes.find(n => n.data.groupRoot === node.data.group);
    //     if (!groupNode) {
    //         vueProps.node = new ReteNode("groupComponent");
    //         vueProps.node.data.groupRoot = node.data.group;
    //         const app = createVue(el, vueComponent, vueProps, options);

    //         vueProps.node.vueContext = app.$children[0];
    //         editor.addNode(vueProps.node);
    //     }
    // }

    const app = createVue(el, vueComponent, vueProps, options);

    vueProps.node.vueContext = app.$children[0];
    return app;
}

function createControl(editor, { el, control }, options) {
    // console.log({editor, data: {el, control}, options});
    const vueComponent = control.component;
    const vueProps = { ...control.props, getData: control.getData.bind(control), putData: control.putData.bind(control) };
    const app = createVue(el, vueComponent, vueProps, options);

    control.vueContext = app.$children[0];

    return app;
}

const update = (entity) => {
    return new Promise((res) => {
        if (!entity.vueContext) return res();
        // console.log("update")
           
        // if (entity.data.group) {
        //     entity.vueContext.hide();
        //      if(!window.editor.nodes.find(n => n.data.groupRoot === entity.data.group)) {
        //          const newNode = new ReteNode("groupComponent");
        //          newNode.data.groupRoot = entity.data.group
        //          window.editor.addNode(newNode)
        //      }
        //  }

        entity.vueContext.$forceUpdate();
        entity.vueContext.$nextTick(res);
    });
};

function install(editor, { component: CommonVueComponent, options }) {
    editor.on("rendernode", ({ el, node, component, bindSocket, bindControl }) => {
        if (component.render && component.render !== "vue") return;
        node._vue = createNode(editor, CommonVueComponent, { el, node, component, bindSocket, bindControl }, options);
        node.update = async () => await update(node);

        
    });

    editor.on("rendercontrol", ({ el, control }) => {
        if (control.render && control.render !== "vue") return;
        control._vue = createControl(editor, { el, control }, options);
        control.update = async () => await update(control);
    });

    editor.on("connectioncreated connectionremoved", connection => {
        update(connection.output.node);
        update(connection.input.node);
    });

    editor.on("nodeselected", () => {
         editor.nodes.map(update);
    });
}

export default {
    name: "vue-render",
    install,
    mixin,
    Node,
    Socket
};
