import {Component} from "../rete";

import CustomNodeComponent from "./group.vue";


export class GroupComponent extends Component {
    constructor() {
        super("groupComponent");
        // ...
        this.data.render = "vue";
        this.data.component = CustomNodeComponent; // Vue.js component, not required
        this.data.props = {}; // props for the component above, not required

    }

    builder(node) {
        return node;
    }
}

export const g = new GroupComponent();
