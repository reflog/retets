<template>
    <div id="app">
        <h2>Flow Editor</h2>
        <button @click="btnClick">remove second node in group</button>
        <div id="rete"/>
    </div>
</template>

<script>
import { createFlowEditor } from "./editor";
import "./flow.css";

export default {
    mounted() {
        createFlowEditor();
    },
    methods: {
        btnClick: function(){
            window.editor.removeNodeFromGroup(window.editor.nodes[3]);
        }
    }
};
</script>

<style>
#app {
    width: 95%;
    height: 600px;
}

#rete {
    margin: 0 auto;
    width: 99%;
    height: 100%;
    border: 1px solid #333;
}
</style>
