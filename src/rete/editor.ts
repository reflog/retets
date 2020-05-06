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

export function nodesBBox(editor: NodeEditor, nodes: Node[], margin: number) {
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

class NodeGroup {
    nodes: Node[] = [];
    minimized = false;
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
        this.on('translatenode', ({ dx, dy }) => this.selected.each(n => {
            const nodeView = this.view.nodes.get(n);

            nodeView && nodeView.onDrag(dx, dy)
        }));
    }
    onGroupTranslate = (group: string, x: number, y: number, e: PointerEvent) => {
        console.log("onGroupTranslate", x, y, e);
        this.groups[group].nodes.map(n => this.view.nodes.get(n)!).forEach(v => {
            // v.node.position[0] = x * this.view.area.transform.k + v._startPosition[0];
            // v.node.position[1] = y * this.view.area.transform.k + v._startPosition[1];
            // v.update();
            v.translate(v.node.position[0] + 0.1*x * this.view.area.transform.k, v.node.position[1]+ 0.1*y * this.view.area.transform.k)
        });
        this.updateGroup(group);
    }

    addNode(node: Node) {
        if (!this.trigger('nodecreate', node)) return;
        this.nodes.push(node);
        this.view.addNode(node);
        
        this.trigger('nodecreated', node);
        if (node.data.group) {
            const group = (node.data.group as string);
            if (!this.groups[group]) {        
                this.groups[group] = new NodeGroup();
                const groupElement = document.createElement('div');
                groupElement.id = `group-${group}`;
                groupElement.style.position = 'absolute';
                groupElement.style.zIndex = '-1';
                (groupElement as any).dragHandler = new Drag(groupElement, (x,y,e) => this.onGroupTranslate(group,x,y,e));
                const groupMinimizeElement = document.createElement('div');
                groupMinimizeElement.id = `group-${group}-min`;
                groupMinimizeElement.style.position = 'absolute';
                groupMinimizeElement.style.zIndex = '-1';
                groupMinimizeElement.style.backgroundColor = 'red';
                groupMinimizeElement.style.width = "30px";
                groupMinimizeElement.style.height = "30px";
                groupMinimizeElement.addEventListener('pointerdown', () => {
                    this.minimizeGroup(group)
                });
                this.view.container.children[0].appendChild(groupElement)
                groupElement.appendChild(groupMinimizeElement)
            }
            this.groups[group].nodes.push(node);
            this.updateGroup(group);
        }
    }

    minimizeGroup(group: string) {
        this.groups[group].minimized = !this.groups[group].minimized;
        this.groups[group].nodes.map(n => this.view.nodes.get(n)!.el).forEach(el => {
            if(el.style.display === 'none')
                el.style.display = 'block';
            else
                el.style.display = 'none';
        })
        this.updateGroup(group);
    }
    
    updateGroup(group: string) {
        if (this.groups[group].nodes.length > 0) {
            const g = this.groups[group];
            for (let index = 0; index < g.nodes.length; index++) {
                const element = g.nodes[index];
                const firstOrLast = index === 0 || index === g.nodes.length - 1;
                if (this.groups[group].minimized)
                    this.view.nodes.get(element)!.setCustomClass(firstOrLast ? "sideGrouped" : "regularGrouped");
                else
                    this.view.nodes.get(element)!.setCustomClass("");
                if (!(firstOrLast)) {
                    element.getConnections().forEach(con => {
                        this.view.connections.get(con)!.el.style.display = g.minimized ? "none" : "block";
                    })    
                }
            }            
        }

        const el = document.getElementById(`group-${group}`);
        const bbox = nodesBBox(this, this.groups[group].nodes, 10);
        const x = bbox.left;
        const y = bbox.top;
        const scale = 1.0;
        el!.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
        el!.style.width = bbox.width + 'px';
        el!.style.backgroundColor = 'green'
        el!.style.height = bbox.height + 'px';
        
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
        const nodes: {[key: string]: Node} = {};

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
