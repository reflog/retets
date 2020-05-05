<template>
  <div @click="click">group</div>
</template>
<script>
/* eslint-disable */

import Vue from "vue";

export default Vue.extend({
  props: ["readonly", "emitter", "ikey", "node"],
  data() {
    return {
      hidden: true
    };
  },
  methods: {
    click: function() {
      const groupRoot = this.node.data.groupRoot;
      window.editor.nodes.forEach(n => {
        if (n.data.group === groupRoot) {
          n.data.group = null;
          n.vueContext.show();
          n.update();
        }
        if (n.data.groupRoot === groupRoot) {
          window.editor.removeNode(n);
        }
      });

      //   window.editor.fromJSON(json);

      window.editor.trigger("process");
      window.editor.view.resize();
      console.log(window.editor.nodes.map(n => n.data));
    }
  },
  mounted() {},
  updated() {}
});
</script>