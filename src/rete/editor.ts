import { Component } from './component';
import { Connection } from './connection';
import { Context } from './core/context';
import { Data } from './core/data';
import { EditorView } from './view/index';
import { Input } from './input';
import { Node } from './node';
import { Output } from './output';
import { Selected } from './selected';
import { Validator } from './core/validator';
import { listenWindow } from './view/utils';
import { EditorEvents, EventsTypes } from './events';
import { Drag } from './view/drag';

const min = (arr: number[]) => arr.length === 0 ? 0 : Math.min(...arr);
const max = (arr: number[]) => arr.length === 0 ? 0 : Math.max(...arr);

type Rect = {
    left: number;
    right: number;
    top: number;
    bottom: number;
    width?: number;
    height?: number;
    getCenter?: () => number[];
}

export function nodesBBox(editor: NodeEditor, nodes: Node[], margin: number): Rect {
    const left = min(nodes.map(node => node.position[0])) - margin;
    const top = min(nodes.map(node => node.position[1])) - margin;
    const right = max(nodes.map(node => node.position[0] + editor.view.nodes.get(node)!.el.clientWidth)) + 2 * margin;
    const bottom = max(nodes.map(node => node.position[1] + editor.view.nodes.get(node)!.el.clientHeight)) + 2 * margin;

    return {
        left,
        right,
        top,
        bottom,
        width: Math.abs(left - right),
        height: Math.abs(top - bottom),
        getCenter: () => {
            return [
                (left + right) / 2,
                (top + bottom) / 2
            ];
        }
    };
}


export function containsRect(r1: Rect, r2: Rect) {
    return (
        r2.left > r1.left &&
        r2.right < r1.right &&
        r2.top > r1.top &&
        r2.bottom < r1.bottom
    );
}

class NodeGroup {
    dragStart = [0, 0];
    el: HTMLElement;
    x = 0;
    y = 0;
    dragging = false;
    constructor(private editor: NodeEditor, public name: string, public nodes: Node[] = [], public minimized = false) {
        const groupElement = document.createElement('div');
        groupElement.id = `group-${name}`;
        groupElement.style.position = 'absolute';
        groupElement.style.zIndex = '-1';
        (groupElement as any).dragHandler = new Drag(groupElement, this.onTranslate, this.onStart, this.onDrag);
        const groupMinimizeElement = document.createElement('div');
        groupMinimizeElement.id = `group-${name}-min`;
        groupMinimizeElement.style.position = 'absolute';
        groupMinimizeElement.style.zIndex = '-1';
        groupMinimizeElement.style.backgroundColor = 'red';
        groupMinimizeElement.style.width = "30px";
        groupMinimizeElement.style.height = "30px";
        groupMinimizeElement.addEventListener('pointerdown', this.toggleMinimize);
        this.editor.view.container.children[0].appendChild(groupElement)
        groupElement.appendChild(groupMinimizeElement)
        this.el = groupElement;
    }

    toggleMinimize = () => {
        this.minimized = !this.minimized;
        this.updateNodesVisibility();
        this.editor.trigger('process');
    }

    removeNode(n: Node) {
        this.nodes.splice(this.nodes.indexOf(n), 1);
        delete n.data.group;
        this.update();
    }

    canTranslateNode(node: Node, x: number, y: number): boolean {
        if (this.dragging) return true;
        const el = (this.editor.view.nodes.get(node)!).el;
        const { width, height } = el.getBoundingClientRect();
        const t1 = y < this.y;
        const t2 = y + height + 60 > this.y + this.el.clientHeight;
        const t3 = x < this.x;
        const t4 = x + width + 70 > this.x + this.el.clientWidth;
        const outside = (t1 || t2 || t3 || t4)
        return !outside;
    }

    updateNodesVisibility() {
        if (this.nodes.length > 0) {
            
            for (let index = 0; index < this.nodes.length; index++) {
                const element = this.nodes[index];
                const nodeView = (this.editor.view.nodes.get(element)!);
                nodeView.el.style.display = this.minimized ? 'none' : 'block';
                if (index > 0 && this.minimized) {
                    nodeView.translate(this.nodes[0].position[0] + 130,this.nodes[0].position[1])
                } 
                const firstOrLast = index === 0 || index === this.nodes.length - 1;
                if (this.minimized)
                    nodeView.setCustomClass(firstOrLast ? "sideGrouped" : "regularGrouped");
                else
                    nodeView.setCustomClass("");
                element.getConnections().forEach(con => {
                    const conView = (this.editor.view.connections.get(con)!);
                    if (!(firstOrLast)) {
                        conView.el.style.display = this.minimized ? "none" : "block";
                    }
                    conView.update();
                })
            }
            this.update()
        }
    }

    update() {
        const bbox = nodesBBox(this.editor, this.nodes, 30);
        this.x = bbox.left;
        this.y = bbox.top;
        const scale = 1.0;
        this.el.style.transform = `translate(${this.x}px, ${this.y}px) scale(${scale})`;
        this.el.style.width = (this.minimized ? 160 : bbox.width) + 'px';
        this.el.style.backgroundColor = 'green'
        this.el.style.height = (this.minimized ? 160 : bbox.height) + 'px';

    }


    onStart = (_e: PointerEvent) => {
        this.dragStart = [0, 0];
        this.dragging = true;
    }

    onDrag = (_e: PointerEvent) => {
        this.dragging = false;
    }

    onTranslate = (x: number, y: number, e: PointerEvent) => {
        const dx = x - this.dragStart[0];
        const dy = y - this.dragStart[1];
        this.dragStart = [x, y];
        this.nodes.map(n => this.editor.view.nodes.get(n)!).forEach(v => {
            v.translate(v.node.position[0] + dx * this.editor.view.area.transform.k, v.node.position[1] + dy * this.editor.view.area.transform.k)
        });
        this.update();
    }
}

export class NodeEditor extends Context<EventsTypes> {
    groups: { [key: string]: NodeGroup } = {};
    nodes: Node[] = [];
    selected = new Selected();
    view: EditorView;

    constructor(id: string, container: HTMLElement) {
        super(id, new EditorEvents());

        this.view = new EditorView(container, this.components, this);

        this.on('destroy', listenWindow('keydown', e => this.trigger('keydown', e)));
        this.on('destroy', listenWindow('keyup', e => this.trigger('keyup', e)));

        this.on('selectnode', ({ node, accumulate }) => this.selectNode(node, accumulate));
        this.on('nodeselected', () => this.selected.each(n => {
            const nodeView = this.view.nodes.get(n);

            nodeView && nodeView.onStart()
        }));
        this.on('nodetranslate', ({ node, x, y }) => {
            if (node.data.group) {
                return this.groups[node.data.group as string].canTranslateNode(node, x, y);
            }
            return true
        });

        this.on('translatenode', ({ dx, dy }) => this.selected.each(n => {
            const nodeView = this.view.nodes.get(n);

            nodeView && nodeView.onDrag(dx, dy)
        }));
    }

    addNode(node: Node) {
        if (!this.trigger('nodecreate', node)) return;
        this.nodes.push(node);
        this.view.addNode(node);

        this.trigger('nodecreated', node);
        if (node.data.group) {
            const group = (node.data.group as string);
            if (!this.groups[group]) {
                this.groups[group] = new NodeGroup(this, group);
            }
            this.groups[group].nodes.push(node);
            this.groups[group].update()
        }
    }

    removeNodeFromGroup(node: Node) {
        if (node.data.group) {
            this.groups[node.data.group as string].removeNode(node);
        }
    }

    removeNode(node: Node) {
        if (!this.trigger('noderemove', node)) return;

        node.getConnections().forEach(c => this.removeConnection(c));

        this.nodes.splice(this.nodes.indexOf(node), 1);
        this.view.removeNode(node);

        this.trigger('noderemoved', node);
    }

    connect(output: Output, input: Input, data: unknown = {}) {
        if (!this.trigger('connectioncreate', { output, input })) return;

        try {
            const connection = output.connectTo(input);

            connection.data = data;
            this.view.addConnection(connection);

            this.trigger('connectioncreated', connection);
        } catch (e) {
            this.trigger('warn', e)
        }
    }

    removeConnection(connection: Connection) {
        if (!this.trigger('connectionremove', connection)) return;

        this.view.removeConnection(connection);
        connection.remove();

        this.trigger('connectionremoved', connection);
    }

    selectNode(node: Node, accumulate = false) {
        if (this.nodes.indexOf(node) === -1)
            throw new Error('Node not exist in list');

        if (!this.trigger('nodeselect', node)) return;

        this.selected.add(node, accumulate);

        this.trigger('nodeselected', node);
    }

    getComponent(name: string) {
        const component = this.components.get(name);

        if (!component)
            throw `Component ${name} not found`;

        return component as Component;
    }

    register(component: Component) {
        super.register(component)
        component.editor = this;
    }

    clear() {
        [...this.nodes].forEach(node => this.removeNode(node));
        this.trigger('clear');
    }

    toJSON() {
        const data: Data = { id: this.id, nodes: {} };

        this.nodes.forEach(node => data.nodes[node.id] = node.toJSON());
        this.trigger('export', data);
        return data;
    }

    beforeImport(json: Data) {
        const checking = Validator.validate(this.id, json);

        if (!checking.success) {
            this.trigger('warn', checking.msg);
            return false;
        }

        this.silent = true;
        this.clear();
        this.trigger('import', json);
        return true;
    }

    afterImport() {
        this.silent = false;
        return true;
    }

    async fromJSON(json: Data) {
        if (!this.beforeImport(json)) return false;
        const nodes: { [key: string]: Node } = {};

        try {
            await Promise.all(Object.keys(json.nodes).map(async id => {
                const node = json.nodes[id];
                const component = this.getComponent(node.name);

                nodes[id] = await component.build(Node.fromJSON(node));
                this.addNode(nodes[id]);
            }));

            Object.keys(json.nodes).forEach(id => {
                const jsonNode = json.nodes[id];
                const node = nodes[id];

                Object.keys(jsonNode.outputs).forEach(key => {
                    const outputJson = jsonNode.outputs[key];

                    outputJson.connections.forEach(jsonConnection => {
                        const nodeId = jsonConnection.node;
                        const data = jsonConnection.data;
                        const targetOutput = node.outputs.get(key);
                        const targetInput = nodes[nodeId].inputs.get(jsonConnection.input);

                        if (!targetOutput || !targetInput) {
                            return this.trigger('error', `IO not found for node ${node.id}`);
                        }

                        this.connect(targetOutput, targetInput, data);
                    });
                });

            });
        } catch (e) {
            this.trigger('warn', e);
            return !this.afterImport();
        }

        return this.afterImport();
    }
} 